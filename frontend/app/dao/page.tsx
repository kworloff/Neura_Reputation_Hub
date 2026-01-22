'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getCurrentAccount } from '@/lib/web3'
import { getReputationDAOContract, getReputationTokenContract, getReputationHubContract } from '@/lib/contracts'
import { getReputationBalance } from '@/lib/reputation'
import { formatAddress, formatAddressOrName, formatDate } from '@/lib/utils'
import FAQ from '@/components/FAQ'

const WalletConnect = dynamic(() => import('@/components/web3/WalletConnect'), { ssr: false })

interface Proposal {
  id: number
  proposer: string
  description: string
  deadline: number
  votesFor: bigint
  votesAgainst: bigint
  executed: boolean
  createdAt: number
}

export default function DAOPage() {
  const [address, setAddress] = useState<string | null>(null)
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isVoting, setIsVoting] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showVoteModal, setShowVoteModal] = useState<number | null>(null)
  const [proposalDescription, setProposalDescription] = useState('')
  const [proposalDeadline, setProposalDeadline] = useState('')
  const [voteAmount, setVoteAmount] = useState('')
  const [voteSupport, setVoteSupport] = useState<boolean>(true)

  const daoAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_DAO || ''
  const tokenAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN || ''

  useEffect(() => {
    loadProposals()
  }, [])

  useEffect(() => {
    let mounted = true
    const check = async () => {
      const account = await getCurrentAccount()
      if (!mounted) return
      setAddress(account)
      if (account && tokenAddress) {
        try {
          const balance = await getReputationBalance(tokenAddress, account)
          setTokenBalance(balance)
        } catch (e) {
          console.error('Failed to load balance:', e)
        }
      }
    }
    check()
    const interval = setInterval(check, 2500)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const loadProposals = async () => {
    if (!daoAddress) {
      setError('DAO contract address not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const daoContract = getReputationDAOContract(daoAddress)
      const count = await daoContract.proposalCount()
      const proposalCount = Number(count)

      if (proposalCount === 0) {
        setProposals([])
        setIsLoading(false)
        return
      }

      // Загружаем все предложения
      const loadedProposals: Proposal[] = []
      for (let i = 1; i <= proposalCount; i++) {
        try {
          const proposal = await daoContract.getProposal(i)
          loadedProposals.push({
            id: Number(proposal.id),
            proposer: proposal.proposer,
            description: proposal.description,
            deadline: Number(proposal.deadline),
            votesFor: BigInt(proposal.votesFor.toString()),
            votesAgainst: BigInt(proposal.votesAgainst.toString()),
            executed: proposal.executed,
            createdAt: Number(proposal.createdAt || proposal.deadline), // Fallback для старых предложений
          })
        } catch (e) {
          console.error(`Error loading proposal ${i}:`, e)
        }
      }

      // Сортируем по ID (новые первыми)
      loadedProposals.sort((a, b) => b.id - a.id)
      setProposals(loadedProposals)
    } catch (err: any) {
      console.error('Error loading proposals:', err)
      setError(err.message || 'Failed to load proposals')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProposal = async () => {
    if (!address || !daoAddress) {
      setError('Wallet not connected or contract address not set')
      return
    }

    if (!proposalDescription.trim()) {
      setError('Please enter a proposal description')
      return
    }

    const deadlineDate = new Date(proposalDeadline)
    if (isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      setError('Please select a valid future date')
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const daoContract = getReputationDAOContract(daoAddress, signer)

      // Получаем адрес Hub из переменных окружения
      const hubAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB || ''
      if (!hubAddress) {
        throw new Error('Hub contract address not configured')
      }

      // Предварительная проверка репутации через Hub
      const hubContract = getReputationHubContract(hubAddress)
      const reputationScore = await hubContract.getReputationScore(address)
      const minReputation = await daoContract.MIN_REPUTATION_TO_PROPOSE()
      
      if (reputationScore < minReputation) {
        const minRepFormatted = ethers.formatEther(minReputation)
        throw new Error(`Insufficient reputation. You have ${ethers.formatEther(reputationScore)} REP, but need at least ${minRepFormatted} REP to create a proposal`)
      }

      // Проверяем, может ли пользователь создать предложение
      const canCreate = await daoContract.canCreateProposal(address)
      if (!canCreate) {
        const proposalsThisMonth = await daoContract.getProposalsInLastMonth(address)
        throw new Error(`Monthly limit reached. You have created ${proposalsThisMonth.toString()} proposal(s) this month (max: 2)`)
      }

      const deadlineTimestamp = Math.floor(deadlineDate.getTime() / 1000)
      
      // Проверяем, что дедлайн в будущем (дополнительная проверка)
      const currentTimestamp = Math.floor(Date.now() / 1000)
      if (deadlineTimestamp <= currentTimestamp) {
        throw new Error('Deadline must be in the future')
      }

      // Пытаемся оценить газ перед отправкой
      try {
        await daoContract.createProposal.estimateGas(proposalDescription, deadlineTimestamp)
      } catch (estimateError: any) {
        // Если оценка газа не удалась, это означает revert
        let errorMessage = 'Failed to create proposal'
        
        if (estimateError.message?.includes('Insufficient reputation')) {
          errorMessage = 'You need at least 10 REP to create a proposal'
        } else if (estimateError.message?.includes('Deadline must be in the future')) {
          errorMessage = 'Deadline must be in the future'
        } else if (estimateError.message?.includes('Monthly proposal limit reached')) {
          errorMessage = 'Monthly proposal limit reached (max 2 proposals per month)'
        } else if (estimateError.message?.includes('Description cannot be empty')) {
          errorMessage = 'Description cannot be empty'
        } else if (estimateError.data || estimateError.reason) {
          errorMessage = estimateError.reason || 'Transaction would revert. Please check your reputation and proposal limits.'
        } else {
          errorMessage = 'Transaction would revert. Possible reasons: insufficient reputation (<10 REP), monthly limit reached, or invalid deadline.'
        }
        
        throw new Error(errorMessage)
      }

      const tx = await daoContract.createProposal(proposalDescription, deadlineTimestamp)
      setSuccess('Proposal created! Waiting for confirmation...')

      await tx.wait()
      setSuccess('Proposal created successfully!')

      // Очищаем форму и закрываем модал
      setProposalDescription('')
      setProposalDeadline('')
      setError(null) // Очищаем ошибку только при успехе
      setSuccess(null) // Очищаем сообщение об успехе через некоторое время
      setShowCreateModal(false)

      // Обновляем список предложений
      await loadProposals()
    } catch (err: any) {
      console.error('Error creating proposal:', err)
      
      let errorMessage = 'Failed to create proposal'
      
      if (err.message?.includes('user rejected') || err.code === 4001) {
        errorMessage = 'Transaction rejected by user'
      } else if (err.message?.includes('Insufficient reputation') || err.message?.includes('need at least')) {
        errorMessage = err.message
      } else if (err.message?.includes('Monthly limit') || err.message?.includes('limit reached')) {
        errorMessage = err.message
      } else if (err.message?.includes('Deadline must be in the future')) {
        errorMessage = err.message
      } else if (err.message?.includes('CALL_EXCEPTION') || err.message?.includes('missing revert data')) {
        errorMessage = 'Transaction failed. Possible reasons: insufficient reputation (<10 REP), monthly limit reached (max 2 per month), or invalid deadline. Please check your account and try again.'
      } else if (err.message) {
        errorMessage = err.message
      }
      
      setError(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const handleVote = async (proposalId: number) => {
    if (!address || !daoAddress || !tokenAddress) {
      setError('Wallet not connected or contract addresses not set')
      return
    }

    const amountNum = parseFloat(voteAmount)
    if (!voteAmount || isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid vote amount')
      return
    }

    const balanceNum = parseFloat(tokenBalance)
    if (amountNum > balanceNum) {
      setError(`Insufficient balance. You have ${balanceNum.toFixed(2)} REP`)
      return
    }

    setIsVoting(proposalId)
    setError(null)
    setSuccess(null)

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const daoContract = getReputationDAOContract(daoAddress, signer)

      const amountWei = ethers.parseEther(amountNum.toString())
      const tx = await daoContract.vote(proposalId, voteSupport, amountWei)
      setSuccess('Vote submitted! Waiting for confirmation...')

      await tx.wait()
      setSuccess('Vote cast successfully!')

      // Очищаем форму и закрываем модал
      setVoteAmount('')
      setError(null) // Очищаем ошибку только при успехе
      setSuccess(null) // Очищаем сообщение об успехе через некоторое время
      setShowVoteModal(null)

      // Обновляем список предложений
      await loadProposals()
    } catch (err: any) {
      if (err.message?.includes('user rejected') || err.code === 4001) {
        setError('Transaction rejected by user')
      } else if (err.message?.includes('Already voted')) {
        setError('You have already voted on this proposal')
      } else if (err.message?.includes('deadline passed')) {
        setError('Voting deadline has passed')
      } else {
        setError(err.message || 'Failed to cast vote')
      }
    } finally {
      setIsVoting(null)
    }
  }

  const formatAmount = (amount: bigint): string => {
    try {
      const formatted = ethers.formatEther(amount.toString())
      return parseFloat(formatted).toFixed(2)
    } catch {
      return amount.toString()
    }
  }

  const getProposalStatus = (proposal: Proposal): string => {
    const now = Math.floor(Date.now() / 1000)
    if (proposal.executed) return 'Executed'
    if (now > proposal.deadline) return 'Closed'
    return 'Active'
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Active': return 'bg-green-500'
      case 'Closed': return 'bg-gray-500'
      case 'Executed': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="min-h-screen p-8 md:p-24">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="mb-6 flex flex-wrap gap-4 justify-center items-center">
          <Link href="/" className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium text-sm">
            Home
          </Link>
          <Link href="/mint" className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm">
            Mint Reputation
          </Link>
          <Link href="/transfer" className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium text-sm">
            Transfer Reputation
          </Link>
          <Link href="/feed" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm">
            View Feed
          </Link>
          <WalletConnect />
        </div>

        <h1 className="text-4xl font-bold text-center mb-8">DAO Governance</h1>

        {!address && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg text-center">
            <p className="text-amber-800 dark:text-amber-200 mb-3">Connect your wallet to create proposals and vote.</p>
            <WalletConnect />
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <h2 className="text-2xl font-semibold">Proposals</h2>
            <div className="flex items-center gap-4">
              {address && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Your REP: <span className="font-bold">{parseFloat(tokenBalance).toFixed(2)}</span>
                </div>
              )}
              <button
                onClick={() => setShowCreateModal(true)}
                disabled={!address}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm"
              >
                {address ? 'Create Proposal' : 'Connect to create'}
              </button>
            </div>
          </div>

          {/* Requirements Info */}
          {address && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Requirements:</strong> Minimum 10 REP to create proposal. Maximum 2 proposals per wallet per month.
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading proposals...</p>
            </div>
          ) : error && !proposals.length ? (
            <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No proposals yet.</p>
              <p className="text-sm text-gray-400 mt-2">
                Be the first to create a proposal!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map((proposal) => {
                const status = getProposalStatus(proposal)
                const totalVotes = proposal.votesFor + proposal.votesAgainst
                const votesForPercent = totalVotes > 0 
                  ? (Number(proposal.votesFor) / Number(totalVotes)) * 100 
                  : 0
                const isActive = status === 'Active'
                const now = Math.floor(Date.now() / 1000)
                const timeRemaining = proposal.deadline - now

                return (
                  <div
                    key={proposal.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs text-white ${getStatusColor(status)}`}>
                            {status}
                          </span>
                          <span className="text-sm text-gray-500">Proposal #{proposal.id}</span>
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{proposal.description}</h3>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          <span>Proposed by: </span>
                          <Link
                            href={`/profile/${proposal.proposer}`}
                            className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {formatAddressOrName(proposal.proposer)}
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Voting Results */}
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          For: {formatAmount(proposal.votesFor)} REP
                        </span>
                        <span className="text-red-600 dark:text-red-400 font-medium">
                          Against: {formatAmount(proposal.votesAgainst)} REP
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-green-500 h-2 rounded-full transition-all"
                          style={{ width: `${votesForPercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Total votes: {formatAmount(totalVotes)} REP
                      </div>
                    </div>

                    {/* Deadline */}
                    <div className="text-xs text-gray-500 mb-3">
                      {isActive ? (
                        <span>
                          Deadline: {formatDate(proposal.deadline)} 
                          {timeRemaining > 0 && (
                            <span> ({Math.floor(timeRemaining / 86400)} days remaining)</span>
                          )}
                        </span>
                      ) : (
                        <span>Closed: {formatDate(proposal.deadline)}</span>
                      )}
                    </div>

                    {/* Vote Button */}
                    {isActive && address && (
                      <button
                        onClick={() => setShowVoteModal(proposal.id)}
                        className="w-full py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm"
                      >
                        Vote
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {success && (
            <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
              <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
            </div>
          )}

          {error && proposals.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Create Proposal Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Create New Proposal</h3>
              
              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Success Display */}
              {success && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Proposal Description
                  </label>
                  <textarea
                    value={proposalDescription}
                    onChange={(e) => setProposalDescription(e.target.value)}
                    placeholder="Describe your proposal..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voting Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={proposalDeadline}
                    onChange={(e) => setProposalDeadline(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCreateProposal}
                    disabled={isCreating}
                    className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                  >
                    {isCreating ? 'Creating...' : 'Create Proposal'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setProposalDescription('')
                      setProposalDeadline('')
                      // Не очищаем error, чтобы она была видна после закрытия модального окна
                    }}
                    className="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vote Modal */}
        {showVoteModal !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Vote on Proposal #{showVoteModal}</h3>
              
              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {/* Success Display */}
              {success && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Your Vote
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVoteSupport(true)}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors font-medium ${
                        voteSupport
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      For
                    </button>
                    <button
                      onClick={() => setVoteSupport(false)}
                      className={`flex-1 py-2 px-4 rounded-lg transition-colors font-medium ${
                        !voteSupport
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      Against
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Voting Power (REP)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={voteAmount}
                      onChange={(e) => setVoteAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      max={tokenBalance}
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    />
                    <button
                      onClick={() => setVoteAmount(tokenBalance)}
                      className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      Max
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Available: {parseFloat(tokenBalance).toFixed(2)} REP
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    ✓ Your tokens stay in your wallet - they're only used to determine voting weight
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleVote(showVoteModal)}
                    disabled={isVoting === showVoteModal || !voteAmount}
                    className="flex-1 py-2 px-4 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
                  >
                    {isVoting === showVoteModal ? 'Voting...' : 'Cast Vote'}
                  </button>
                  <button
                    onClick={() => {
                      setShowVoteModal(null)
                      setVoteAmount('')
                      setVoteSupport(true)
                      // Не очищаем error, чтобы она была видна после закрытия модального окна
                    }}
                    className="flex-1 py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        <FAQ
          items={[
            {
              question: 'How does DAO voting work?',
              answer: 'DAO voting uses reputation tokens (REP) to determine voting power. The more REP tokens you use when voting, the more weight your vote has. Your tokens remain in your wallet - they are only used to calculate voting power.',
            },
            {
              question: 'What are the requirements to create a proposal?',
              answer: 'You need at least 10 REP reputation tokens to create a proposal. Additionally, each wallet can create a maximum of 2 proposals per month to prevent spam.',
            },
            {
              question: 'Can I vote multiple times on the same proposal?',
              answer: 'No, you can only vote once per proposal. Make sure to choose the right amount of reputation to use for your vote as you cannot change it later.',
            },
            {
              question: 'What happens if a proposal deadline passes?',
              answer: 'Once the voting deadline passes, the proposal is considered closed. The results are final and the proposal cannot be voted on anymore.',
            },
            {
              question: 'How is voting power calculated?',
              answer: 'Your voting power equals the amount of REP tokens you choose to use when voting. You can use any amount from 0.01 REP up to your total balance. The more REP you use, the stronger your vote.',
            },
          ]}
        />
      </div>
    </div>
  )
}
