'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getReputationHubContract } from '@/lib/contracts'
import { formatAddress, formatAddressOrName, formatDate, getEtherscanLink } from '@/lib/utils'
import { ethers } from 'ethers'
import { getProvider } from '@/lib/web3'
import FAQ from '@/components/FAQ'

const WalletConnect = dynamic(() => import('@/components/web3/WalletConnect'), { ssr: false })

interface ReputationTransfer {
  from: string
  to: string
  amount: bigint
  message: string
  timestamp: bigint
  blockNumber: bigint
  txHash?: string
}

export default function FeedPage() {
  const [transfers, setTransfers] = useState<ReputationTransfer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)

  const hubAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB || ''

  useEffect(() => {
    if (hubAddress) {
      loadFeed()
    }
  }, [hubAddress, currentPage])

  const loadFeed = async () => {
    if (!hubAddress) {
      setError('Contract address not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const provider = getProvider()
      const hubContract = getReputationHubContract(hubAddress)
      
      // Получаем общее количество передач
      const count = await hubContract.getTransferCount()
      setTotalCount(Number(count))

      // Вычисляем offset для пагинации
      const offset = (currentPage - 1) * itemsPerPage
      
      // Получаем фид
      const feed = await hubContract.getFeed(itemsPerPage, offset)
      
      // Получаем txHash из событий. RPC "Block range is too large" — строго лимит ~2000 блоков.
      const MAX_BLOCK_RANGE = 2000
      const transferTopic = ethers.id('ReputationTransferred(address,address,uint256,string,uint256)')
      const blockToTxHash = new Map<number, string>()

      if (feed.length > 0) {
        let minBlock = Number(feed[0].blockNumber.toString())
        let maxBlock = minBlock
        for (const transfer of feed) {
          const blockNum = Number(transfer.blockNumber.toString())
          if (blockNum < minBlock) minBlock = blockNum
          if (blockNum > maxBlock) maxBlock = blockNum
        }

        const rangeStart = Math.max(0, minBlock - 50)
        const rangeEnd = maxBlock + 50
        const totalRange = rangeEnd - rangeStart

        if (totalRange <= MAX_BLOCK_RANGE) {
          try {
            const logs = await provider.getLogs({
              address: hubAddress,
              topics: [transferTopic],
              fromBlock: rangeStart,
              toBlock: rangeEnd,
            })
            for (const log of logs) blockToTxHash.set(log.blockNumber, log.transactionHash)
          } catch (e) {
            console.warn('getLogs failed, tx links unavailable:', e)
          }
        } else {
          // Разбиваем на чанки по MAX_BLOCK_RANGE
          for (let from = rangeStart; from <= rangeEnd; from += MAX_BLOCK_RANGE) {
            const to = Math.min(from + MAX_BLOCK_RANGE - 1, rangeEnd)
            try {
              const logs = await provider.getLogs({
                address: hubAddress,
                topics: [transferTopic],
                fromBlock: from,
                toBlock: to,
              })
              for (const log of logs) blockToTxHash.set(log.blockNumber, log.transactionHash)
            } catch (e) {
              console.warn('getLogs chunk failed:', e)
            }
          }
        }
      }
      
      // Конвертируем данные и добавляем txHash
      const formattedFeed: ReputationTransfer[] = feed.map((transfer: any) => {
        const blockNum = Number(transfer.blockNumber.toString())
        return {
          from: transfer.from,
          to: transfer.to,
          amount: BigInt(transfer.amount.toString()),
          message: transfer.message,
          timestamp: BigInt(transfer.timestamp.toString()),
          blockNumber: BigInt(transfer.blockNumber.toString()),
          txHash: blockToTxHash.get(blockNum),
        }
      })

      setTransfers(formattedFeed)
    } catch (err: any) {
      console.error('Error loading feed:', err)
      setError(err.message || 'Failed to load feed')
    } finally {
      setIsLoading(false)
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

  const totalPages = Math.ceil(totalCount / itemsPerPage)

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
          <Link href="/dao" className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm">
            DAO
          </Link>
          <WalletConnect />
        </div>

        <h1 className="text-4xl font-bold text-center mb-8">Reputation Feed</h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Activity Feed</h2>
            <div className="flex items-center gap-4">
              {totalCount > 0 && (
                <span className="text-sm text-gray-500">
                  Total transfers: {totalCount}
                </span>
              )}
              <Link
                href="/transfer"
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium text-sm"
              >
                Transfer Reputation
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading feed...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No reputation transfers yet.</p>
              <p className="text-sm text-gray-400 mt-2 mb-4">
                Be the first to transfer reputation to someone!
              </p>
              <Link
                href="/transfer"
                className="inline-block px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
              >
                Transfer Reputation
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {transfers.map((transfer, index) => (
                  <div
                    key={`${transfer.from}-${transfer.to}-${transfer.timestamp}-${index}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            From:
                          </span>
                          <Link
                            href={`/profile/${transfer.from}`}
                            className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {formatAddressOrName(transfer.from)}
                          </Link>
                          <span className="text-gray-400">→</span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            To:
                          </span>
                          <Link
                            href={`/profile/${transfer.to}`}
                            className="font-mono text-sm text-green-600 dark:text-green-400 hover:underline"
                          >
                            {formatAddressOrName(transfer.to)}
                          </Link>
                        </div>
                        
                        {transfer.message && (
                          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              "{transfer.message}"
                            </p>
                          </div>
                        )}
                      </div>
                      
                      <div className="ml-4 text-right">
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          +{formatAmount(transfer.amount)} REP
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatDate(Number(transfer.timestamp))}</span>
                        <span>•</span>
                        <span>Block: {transfer.blockNumber.toString()}</span>
                      </div>
                      {transfer.txHash ? (
                        <a
                          href={getEtherscanLink(transfer.txHash, 'neura_testnet', 'tx')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline"
                        >
                          View on Explorer
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Transaction not found
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                  >
                    Previous
                  </button>
                  
                  <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || isLoading}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* FAQ */}
        <FAQ
          items={[
            {
              question: 'What is the Reputation Feed?',
              answer: 'The Reputation Feed shows all reputation transfers between users in real-time. Each entry displays who sent reputation to whom, the amount, any message included, and when it happened.',
            },
            {
              question: 'How do I transfer reputation?',
              answer: 'To transfer reputation, go to the Transfer Reputation page, enter the recipient address, amount, and an optional message. You need to have enough reputation tokens in your wallet.',
            },
            {
              question: 'Can I see my past transfers?',
              answer: 'Yes, all your transfers (both sent and received) are visible in the feed. You can filter or search for specific addresses if needed.',
            },
            {
              question: 'Do transfers affect my reputation score?',
              answer: 'When you transfer reputation, your reputation score decreases while the recipient\'s score increases by the same amount. However, transferring reputation can give you social activity points.',
            },
          ]}
        />
      </div>
    </div>
  )
}
