'use client'

import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getCurrentAccount, getProvider } from '@/lib/web3'
import { getReputationHubContract, getReputationTokenContract } from '@/lib/contracts'
import { calculateWalletReputation, getReputationBalance, getReputationScore } from '@/lib/reputation'
import { formatAddress, formatAddressOrName, formatDate, getEtherscanLink } from '@/lib/utils'
import FAQ from '@/components/FAQ'

const WalletConnect = dynamic(() => import('@/components/web3/WalletConnect'), { ssr: false })

interface MintEvent {
  wallet: string
  amount: bigint
  timestamp: number
  blockNumber: number
  txHash: string
}

export default function MintPage() {
  const [address, setAddress] = useState<string | null>(null)
  const [reputationScore, setReputationScore] = useState<string>('0')
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [calculatedScore, setCalculatedScore] = useState<number>(0)
  const [breakdown, setBreakdown] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMinting, setIsMinting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mintFeed, setMintFeed] = useState<MintEvent[]>([])
  const [isLoadingFeed, setIsLoadingFeed] = useState(false)

  const hubAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB || ''
  const tokenAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN || ''

  useEffect(() => {
    loadMintFeed()
  }, [])

  useEffect(() => {
    let mounted = true
    const check = async () => {
      const account = await getCurrentAccount()
      if (!mounted) return
      setAddress(account)
      if (account) loadWalletData(account)
    }
    check()
    const interval = setInterval(check, 2500)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const loadMintFeed = async () => {
    if (!hubAddress) return

    setIsLoadingFeed(true)
    try {
      const provider = getProvider()
      const hubContract = getReputationHubContract(hubAddress)
      
      // Получаем текущий блок
      const currentBlock = await provider.getBlockNumber()
      // Уменьшаем диапазон до 10000 блоков, чтобы избежать ошибки "Block range is too large"
      const fromBlock = Math.max(0, currentBlock - 10000)
      
      // Получаем события ReputationMinted
      const mintTopic = ethers.id('ReputationMinted(address,uint256)')
      const logs = await provider.getLogs({
        address: hubAddress,
        topics: [mintTopic],
        fromBlock,
        toBlock: currentBlock,
      }).catch((err) => {
        // Если диапазон все еще слишком большой, пробуем еще меньше
        console.warn('Failed to get logs for large range, trying smaller range:', err)
        return provider.getLogs({
          address: hubAddress,
          topics: [mintTopic],
          fromBlock: Math.max(0, currentBlock - 5000),
          toBlock: currentBlock,
        })
      })

      // Парсим события
      const events: MintEvent[] = []
      for (const log of logs) {
        try {
          const parsedLog = hubContract.interface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          })
          
          if (parsedLog && parsedLog.name === 'ReputationMinted') {
            const block = await provider.getBlock(log.blockNumber)
            events.push({
              wallet: parsedLog.args[0] as string,
              amount: BigInt(parsedLog.args[1].toString()),
              timestamp: block?.timestamp || 0,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
            })
          }
        } catch (e) {
          console.error('Error parsing log:', e)
        }
      }

      // Сортируем по времени (новые первыми)
      events.sort((a, b) => b.timestamp - a.timestamp)
      setMintFeed(events.slice(0, 50)) // Показываем последние 50
    } catch (err: any) {
      console.error('Error loading mint feed:', err)
    } finally {
      setIsLoadingFeed(false)
    }
  }

  const loadWalletData = async (account: string) => {
    if (!account || !hubAddress || !tokenAddress) return
    try {
      setIsLoading(true)
      setError(null)

      const [score, balance, calculated] = await Promise.all([
        getReputationScore(hubAddress, account).catch(() => '0'),
        getReputationBalance(tokenAddress, account).catch(() => '0'),
        calculateWalletReputation(account, hubAddress).catch(() => ({ score: 0, breakdown: null })),
      ])

      setReputationScore(score)
      setTokenBalance(balance)
      setCalculatedScore(calculated.score)
      setBreakdown(calculated.breakdown)
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet data')
    } finally {
      setIsLoading(false)
    }
  }

  const handleMint = async () => {
    if (!address || !hubAddress) {
      setError('Wallet not connected or contract address not set')
      return
    }

    if (calculatedScore <= 0) {
      setError('Calculated reputation score is 0. You need to have some activity to mint reputation.')
      return
    }

    setIsMinting(true)
    setError(null)
    setSuccess(null)

    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is not installed')
      }

      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Получаем контракт Hub
      const hubContract = getReputationHubContract(hubAddress, signer)
      
      // Рассчитываем количество репутации для минта (в wei)
      const amount = ethers.parseEther(calculatedScore.toString())
      
      // Проверяем максимальное значение
      try {
        const maxMintable = await hubContract.MAX_MINTABLE_REPUTATION()
        if (amount > maxMintable) {
          setError(`Calculated score exceeds maximum mintable reputation (${ethers.formatEther(maxMintable)} REP). Please contact support.`)
          setIsMinting(false)
          return
        }
      } catch (maxErr: any) {
        console.error('Error checking max mintable:', maxErr)
        // Продолжаем, если не удалось проверить
      }
      
      // Проверяем, минтил ли пользователь уже
      let hasMintedBefore = false
      try {
        hasMintedBefore = await hubContract.hasMinted(address)
        if (hasMintedBefore) {
          const currentScore = await hubContract.getReputationScore(address)
          if (amount <= currentScore) {
            setError(`You have already minted ${ethers.formatEther(currentScore)} REP. Your new calculated score (${calculatedScore} REP) must be greater than your current score to update.`)
            setIsMinting(false)
            return
          }
        }
      } catch (checkErr: any) {
        console.error('Error checking mint status:', checkErr)
        // Продолжаем, если не удалось проверить
      }
      
      // Предварительная проверка через estimateGas
      try {
        await hubContract.autoMintReputation.estimateGas(amount)
      } catch (estimateErr: any) {
        let errMsg = 'Cannot mint reputation. '
        if (estimateErr.message?.includes('Amount exceeds maximum')) {
          errMsg = 'Calculated score exceeds maximum mintable reputation (500 REP).'
        } else if (estimateErr.message?.includes('New amount must be greater')) {
          errMsg = 'Your new calculated score must be greater than your current reputation score to update.'
        } else if (estimateErr.reason) {
          errMsg = estimateErr.reason
        } else if (estimateErr.message) {
          errMsg += estimateErr.message
        } else {
          errMsg += 'Check your calculated score and try again.'
        }
        throw new Error(errMsg)
      }
      
      // Вызываем публичную функцию автоматического минта
      const tx = await hubContract.autoMintReputation(amount)
      setSuccess('Transaction sent! Waiting for confirmation...')
      
      await tx.wait()
      setSuccess(hasMintedBefore 
        ? 'Reputation updated successfully!' 
        : 'Reputation minted successfully!')
      
      if (address) await loadWalletData(address)
      await loadMintFeed()
    } catch (err: any) {
      console.error('Mint error:', err)
      if (err.message?.includes('exceeds maximum') || err.message?.includes('must be greater')) {
        setError(err.message)
      } else if (err.message?.includes('CALL_EXCEPTION') || err.message?.includes('missing revert data')) {
        setError('Transaction would fail. Check your calculated score and ensure it does not exceed 500 REP.')
      } else {
        setError(err.message || 'Failed to mint reputation')
      }
    } finally {
      setIsMinting(false)
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
          <Link href="/transfer" className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium text-sm">
            Transfer Reputation
          </Link>
          <Link href="/feed" className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium text-sm">
            View Feed
          </Link>
          <Link href="/dao" className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm">
            DAO
          </Link>
          <WalletConnect />
        </div>
        
        <h1 className="text-4xl font-bold text-center mb-8">Mint Reputation</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Your Reputation</h2>
          
          {!address ? (
            <div className="text-center py-8">
              <p className="text-gray-600 dark:text-gray-400 mb-4">Connect your wallet to view your reputation and mint.</p>
              <WalletConnect />
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Score</p>
                  <p className="text-2xl font-bold">
                    {reputationScore && parseFloat(reputationScore) > 0 
                      ? parseFloat(reputationScore).toFixed(2).replace(/\.?0+$/, '')
                      : '0'}
                  </p>
                </div>
                
                <div className="bg-green-50 dark:bg-green-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Token Balance</p>
                  <p className="text-2xl font-bold">{parseFloat(tokenBalance).toFixed(2)} REP</p>
                </div>
                
                <div className="bg-purple-50 dark:bg-purple-900 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Calculated Score</p>
                  <p className="text-2xl font-bold">{calculatedScore}</p>
                </div>
              </div>

              {breakdown && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <h3 className="font-semibold mb-3">Reputation Breakdown</h3>
                    
                    {/* Transaction History */}
                    <div className="mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">1. Transaction History (46%)</span>
                        <span className="font-bold">{breakdown.transactionHistory?.total || 0} pts</span>
                      </div>
                      <div className="text-xs space-y-1 ml-4 text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Count:</span>
                          <span>{breakdown.transactionHistory?.count || 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Regularity:</span>
                          <span>{breakdown.transactionHistory?.regularity || 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Diversity:</span>
                          <span>{breakdown.transactionHistory?.diversity || 0} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Balance & Activity */}
                    <div className="mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">2. Balance & Activity (31%)</span>
                        <span className="font-bold">{breakdown.balanceActivity?.total || 0} pts</span>
                      </div>
                      <div className="text-xs space-y-1 ml-4 text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Balance:</span>
                          <span>{breakdown.balanceActivity?.balance || 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Stability:</span>
                          <span>{breakdown.balanceActivity?.stability || 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Transfers:</span>
                          <span>{breakdown.balanceActivity?.transfers || 0} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Wallet Age */}
                    <div className="mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">3. Wallet Age (15%)</span>
                        <span className="font-bold">{breakdown.walletAge?.score || 0} pts</span>
                      </div>
                      <div className="text-xs ml-4 text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Age:</span>
                          <span>{breakdown.walletAge?.days || 0} days</span>
                        </div>
                      </div>
                    </div>

                    {/* Social Activity */}
                    <div className="mb-3 pb-3 border-b border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">4. Social Activity (8%)</span>
                        <span className="font-bold">{breakdown.socialActivity?.total || 0} pts</span>
                      </div>
                      <div className="text-xs space-y-1 ml-4 text-gray-600 dark:text-gray-400">
                        <div className="flex justify-between">
                          <span>Reputation Transfers:</span>
                          <span>{breakdown.socialActivity?.reputationTransfers || 0} pts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>DAO Participation:</span>
                          <span>{breakdown.socialActivity?.daoParticipation || 0} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Bonuses */}
                    {breakdown.bonuses > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-green-600 dark:text-green-400">Bonuses</span>
                          <span className="font-bold text-green-600 dark:text-green-400">+{breakdown.bonuses || 0} pts</span>
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="pt-3 border-t-2 border-gray-400 dark:border-gray-500">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">Total Score</span>
                        <span className="font-bold text-lg">{breakdown.total || 0} / 390</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6">
                {(() => {
                  const tokenBalanceNum = parseFloat(tokenBalance || '0');
                  const calculatedScoreNum = calculatedScore || 0;
                  const alreadyMinted = tokenBalanceNum >= calculatedScoreNum * 0.95; // Учитываем небольшие погрешности
                  const canMint = calculatedScoreNum > 0 && !alreadyMinted;
                  
                  if (alreadyMinted && calculatedScoreNum > 0) {
                    return (
                      <div className="w-full py-3 px-6 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg font-medium text-center">
                        Reputation already minted ({tokenBalanceNum.toFixed(2)} REP)
                      </div>
                    );
                  }
                  
                  return (
                    <button
                      onClick={handleMint}
                      disabled={isMinting || !canMint}
                      className="w-full py-3 px-6 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      {isMinting ? 'Minting...' : `Mint ${calculatedScore} Reputation Points`}
                    </button>
                  );
                })()}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded-lg">
                  <p className="text-green-700 dark:text-green-300 text-sm">{success}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mint Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Recent Reputation Mints</h2>
          
          {isLoadingFeed ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading mint history...</p>
            </div>
          ) : mintFeed.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No reputation mints yet. Be the first to mint!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mintFeed.map((event, index) => (
                <div
                  key={`${event.txHash}-${index}`}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          Wallet:
                        </span>
                        <Link
                          href={`/profile/${event.wallet}`}
                          className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {formatAddressOrName(event.wallet)}
                        </Link>
                        {address && event.wallet.toLowerCase() === address.toLowerCase() && (
                          <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-lg font-bold text-green-600 dark:text-green-400">
                        +{parseFloat(ethers.formatEther(event.amount)).toFixed(2)} REP
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatDate(event.timestamp)}</span>
                      <span>•</span>
                      <span>Block: {event.blockNumber}</span>
                    </div>
                    <a
                      href={getEtherscanLink(event.txHash, 'neura_testnet', 'tx')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                    >
                      View on Explorer
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reputation Criteria */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Reputation Criteria</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold mb-2">1. Transaction History (46% - Max 180 points)</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• Transaction Count (0-100 pts): More transactions = higher score</li>
                <li>• Regularity (0-50 pts): Evenly distributed transactions get maximum points</li>
                <li>• Diversity (0-30 pts): Interaction with different contracts increases score</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h3 className="font-semibold mb-2">2. Balance & Activity (31% - Max 120 points)</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• ANKR Balance (0-60 pts): 1-50 ANKR = 10pts, 51-200 = 20pts, 201-500 = 40pts, 501-1000 = 60pts</li>
                <li>• Stability (0-40 pts): Stable balance gets maximum points</li>
                <li>• Transfer Activity (0-20 pts): Regular transfers increase score</li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h3 className="font-semibold mb-2">3. Wallet Age (15% - Max 60 points)</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• &lt;3 months = 5 pts</li>
                <li>• 3-6 months = 15 pts</li>
                <li>• 6-12 months = 30 pts</li>
                <li>• 1-2 years = 45 pts</li>
                <li>• &gt;2 years = 60 pts</li>
              </ul>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold mb-2">4. Social Activity (8% - Max 30 points)</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• Transfer reputation to others = +20 pts</li>
                <li>• Receive reputation = +10 pts</li>
                <li>• Vote in DAO = +10 pts</li>
              </ul>
            </div>

            <div className="border-l-4 border-pink-500 pl-4">
              <h3 className="font-semibold mb-2">Bonuses</h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4">
                <li>• Active in last 30 days = +15 pts</li>
                <li>• Long-term holding (&gt;1 year) = +20 pts</li>
              </ul>
            </div>

            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-sm font-medium">Maximum Total Score: 390 points</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <FAQ
          items={[
            {
              question: 'How is my reputation calculated?',
              answer: 'Your reputation is calculated based on transaction history (46%), balance and activity (31%), wallet age (15%), and social activity (8%). Each category has specific criteria that determine your score. See the Reputation Criteria section above for details.',
            },
            {
              question: 'Do I lose tokens when voting?',
              answer: 'No, your reputation tokens stay in your wallet when you vote. They are only used to determine your voting power - you don\'t lose them.',
            },
            {
              question: 'Can I mint reputation multiple times?',
              answer: 'You can only mint reputation once based on your current calculated score. If your reputation increases, you would need to wait for the next minting period or get the contract owner to mint additional reputation.',
            },
            {
              question: 'How often does my reputation update?',
              answer: 'Your reputation score is calculated in real-time based on your on-chain activity. The calculation updates whenever you check it, reflecting your latest transactions and balance.',
            },
          ]}
        />
      </div>
    </div>
  )
}
