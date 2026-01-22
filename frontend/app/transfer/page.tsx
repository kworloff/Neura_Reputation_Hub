'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ethers } from 'ethers'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getCurrentAccount } from '@/lib/web3'
import { getReputationHubContract, getReputationTokenContract } from '@/lib/contracts'
import { getReputationBalance } from '@/lib/reputation'
import { formatAddress } from '@/lib/utils'
import FAQ from '@/components/FAQ'

const WalletConnect = dynamic(() => import('@/components/web3/WalletConnect'), { ssr: false })

function TransferForm() {
  const searchParams = useSearchParams()
  const [address, setAddress] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [recipient, setRecipient] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [message, setMessage] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const hubAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB || ''
  const tokenAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN || ''

  useEffect(() => {
    const to = searchParams?.get('to')?.trim()
    if (to && ethers.isAddress(to)) {
      setRecipient(ethers.getAddress(to))
    }
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    const check = async () => {
      const account = await getCurrentAccount()
      if (!mounted) return
      setAddress(account)
      if (account && tokenAddress) loadWalletData(account)
    }
    check()
    const interval = setInterval(check, 2500)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const loadWalletData = async (account: string) => {
    if (!tokenAddress) return
    try {
      setIsLoading(true)
      setError(null)
      const balance = await getReputationBalance(tokenAddress, account)
      setTokenBalance(balance)
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTransfer = async () => {
    if (!address || !hubAddress || !tokenAddress) {
      setError('Wallet not connected or contract addresses not set')
      return
    }

    const rawRecipient = (recipient || '').trim()
    if (!rawRecipient) {
      setError('Please enter a valid recipient address')
      return
    }
    if (!ethers.isAddress(rawRecipient)) {
      setError('Please enter a valid recipient address')
      return
    }
    let recipientAddress: string
    try {
      recipientAddress = ethers.getAddress(rawRecipient)
    } catch {
      setError('Please enter a valid recipient address')
      return
    }
    if (recipientAddress === ethers.ZeroAddress) {
      setError('Cannot transfer to zero address')
      return
    }

    const msg = (message || '').trim()
    if (msg.length > 500) {
      setError('Message must be 500 characters or less')
      return
    }

    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount')
      return
    }

    const balanceNum = parseFloat(tokenBalance)
    if (amountNum > balanceNum) {
      setError(`Insufficient balance. You have ${balanceNum.toFixed(2)} REP`)
      return
    }

    setIsTransferring(true)
    setError(null)
    setSuccess(null)

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      const tokenContract = getReputationTokenContract(tokenAddress, signer)
      const hubContract = getReputationHubContract(hubAddress, signer)

      const amountWei = ethers.parseEther(amountNum.toString())

      // Проверяем reputation score в Hub (должен быть >= amount)
      const hub = getReputationHubContract(hubAddress)
      const score = await hub.getReputationScore(address)
      if (score < amountWei) {
        setError(
          'Insufficient reputation score. You can only transfer up to your on-chain reputation score. ' +
          'If you received REP via transfer, your score matches your balance.'
        )
        setIsTransferring(false)
        return
      }

      const allowance = await tokenContract.allowance(address, hubAddress)
      if (allowance < amountWei) {
        setSuccess('Approving tokens...')
        const approveTx = await tokenContract.approve(hubAddress, amountWei)
        await approveTx.wait()
        setSuccess('Tokens approved. Transferring reputation...')
      }

      // Предварительная проверка через estimateGas
      try {
        await hubContract.transferReputation.estimateGas(
          recipientAddress,
          amountWei,
          msg || ''
        )
      } catch (estimateErr: any) {
        let errMsg = 'Transfer would fail. '
        if (estimateErr.message?.includes('Invalid recipient') || estimateErr.message?.includes('zero address')) {
          errMsg = 'Invalid recipient address.'
        } else if (estimateErr.message?.includes('Cannot transfer to self')) {
          errMsg = 'Cannot transfer reputation to yourself.'
        } else if (estimateErr.message?.includes('Insufficient reputation') || estimateErr.message?.includes('Insufficient allowance')) {
          errMsg = 'Insufficient reputation or allowance. Approve tokens and try again.'
        } else if (estimateErr.message?.includes('Message too long')) {
          errMsg = 'Message must be 500 characters or less.'
        } else if (estimateErr.message?.includes('Insufficient reputation score')) {
          errMsg = 'Insufficient reputation score. You can only transfer up to your on-chain reputation.'
        } else if (estimateErr.reason) {
          errMsg = estimateErr.reason
        } else {
          errMsg += 'Check recipient, amount, and message (max 500 chars).'
        }
        throw new Error(errMsg)
      }

      const tx = await hubContract.transferReputation(recipientAddress, amountWei, msg || '')
      setSuccess('Transaction sent! Waiting for confirmation...')

      await tx.wait()
      setSuccess('Reputation transferred successfully!')

      setRecipient('')
      setAmount('')
      setMessage('')
      if (address) await loadWalletData(address)

      setTimeout(() => {
        window.location.href = '/feed'
      }, 2000)
    } catch (err: any) {
      console.error('Transfer error:', err)
      if (err.message?.includes('user rejected') || err.code === 4001) {
        setError('Transaction rejected by user')
      } else if (err.message?.includes('insufficient') || err.message?.includes('Insufficient')) {
        setError(err.message)
      } else if (err.message?.includes('CALL_EXCEPTION') || err.message?.includes('missing revert data')) {
        setError(
          'Transfer failed. Check: valid recipient address, sufficient balance, message ≤500 characters, ' +
          'and that you have approved tokens.'
        )
      } else {
        setError(err.message || 'Failed to transfer reputation')
      }
    } finally {
      setIsTransferring(false)
    }
  }

  const handleMaxAmount = () => {
    const balanceNum = parseFloat(tokenBalance)
    if (balanceNum > 0) {
      setAmount(balanceNum.toString())
    }
  }

  return (
    <div className="min-h-screen p-8 md:p-24">
      <div className="max-w-2xl mx-auto">
        {/* Navigation */}
        <div className="mb-6 flex flex-wrap gap-4 justify-center items-center">
          <Link href="/" className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm">
            Home
          </Link>
          <Link href="/mint" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm">
            Mint Reputation
          </Link>
          <Link href="/feed" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm">
            View Feed
          </Link>
          <Link href="/dao" className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm">
            DAO
          </Link>
          <WalletConnect />
        </div>

        <h1 className="text-4xl font-bold text-center mb-8">Transfer Reputation</h1>

        {!address && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-center">
            <p className="text-amber-800 dark:text-amber-200 mb-3">Connect your wallet to transfer reputation.</p>
            <WalletConnect />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Your Reputation Balance:</span>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {!address ? '—' : isLoading ? '...' : parseFloat(tokenBalance).toFixed(2)} REP
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Recipient Address */}
            <div>
              <label htmlFor="recipient" className="block text-sm font-medium mb-2">
                Recipient Address
              </label>
              <input
                id="recipient"
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium mb-2">
                Amount (REP)
              </label>
              <div className="flex gap-2">
                <input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={handleMaxAmount}
                  className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  Max
                </button>
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-2">
                Message (Optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message for the recipient..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Max 500 characters</p>
            </div>

            {/* Transfer Button */}
            <button
              onClick={handleTransfer}
              disabled={!address || isTransferring || !recipient || !amount || parseFloat(amount) <= 0}
              className="w-full py-3 px-6 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {!address ? 'Connect wallet to transfer' : isTransferring ? 'Transferring...' : 'Transfer Reputation'}
            </button>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> Transferring reputation will reduce your reputation score and increase the recipient's score. 
            The transfer will be visible in the feed.
          </p>
        </div>

        {/* FAQ */}
        <FAQ
          items={[
            {
              question: 'How do I transfer reputation?',
              answer: 'Enter the recipient\'s wallet address, the amount of reputation to transfer (in REP tokens), and optionally add a message. Click "Transfer Reputation" and confirm the transaction in your wallet.',
            },
            {
              question: 'Do I lose reputation when transferring?',
              answer: 'Yes, when you transfer reputation to someone, your reputation score decreases and the recipient\'s score increases by the same amount. This is a real transfer of value.',
            },
            {
              question: 'Can I transfer more reputation than I have?',
              answer: 'No, you can only transfer reputation that you actually have. The system will check your balance before allowing the transfer.',
            },
            {
              question: 'Will the transfer appear in the feed?',
              answer: 'Yes, all reputation transfers are publicly visible in the feed with the amount, message (if provided), and timestamp.',
            },
            {
              question: 'Can I cancel a transfer?',
              answer: 'Once a transfer transaction is confirmed on the blockchain, it cannot be cancelled. Make sure to double-check the recipient address before confirming.',
            },
          ]}
        />
      </div>
    </div>
  )
}

export default function TransferPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Loading...</h2>
        </div>
      </div>
    }>
      <TransferForm />
    </Suspense>
  )
}
