'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ethers } from 'ethers'
import {
  getReputationHubContract,
  getReputationTokenContract,
  getReputationDAOContract,
} from '@/lib/contracts'
import { getReputationBalance } from '@/lib/reputation'
import { formatAddress, formatAddressOrName, formatDate, getAddressDisplayName } from '@/lib/utils'
import FAQ from '@/components/FAQ'

interface TransferRow {
  from: string
  to: string
  amount: bigint
  message: string
  timestamp: bigint
  blockNumber: bigint
}

interface ProposalRow {
  id: number
  description: string
  deadline: number
  votesFor: bigint
  votesAgainst: bigint
  createdAt: number
}

interface VoteRow {
  proposalId: number
  description: string
  amount: bigint
  support: boolean
}

export default function ProfilePage() {
  const params = useParams()
  const addressParam = typeof params?.address === 'string' ? params.address : ''
  const [address, setAddress] = useState<string | null>(null)
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null)
  const [reputationScore, setReputationScore] = useState<string>('0')
  const [tokenBalance, setTokenBalance] = useState<string>('0')
  const [transfers, setTransfers] = useState<TransferRow[]>([])
  const [proposalsCreated, setProposalsCreated] = useState<ProposalRow[]>([])
  const [votesCast, setVotesCast] = useState<VoteRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hubAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB || ''
  const tokenAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN || ''
  const daoAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_DAO || ''

  useEffect(() => {
    const raw = (addressParam || '').trim()
    if (!raw) {
      setError('Invalid profile address')
      setIsLoading(false)
      return
    }
    if (!ethers.isAddress(raw)) {
      setError('Invalid Ethereum address')
      setIsLoading(false)
      return
    }
    try {
      setAddress(ethers.getAddress(raw))
    } catch {
      setError('Invalid Ethereum address')
      setIsLoading(false)
    }
  }, [addressParam])

  useEffect(() => {
    if (!address || !hubAddress || !tokenAddress) return
    loadProfile()
  }, [address, hubAddress, tokenAddress, daoAddress])

  async function loadProfile() {
    if (!address || !hubAddress || !tokenAddress) return
    setIsLoading(true)
    setError(null)
    try {
      const hub = getReputationHubContract(hubAddress)
      const token = getReputationTokenContract(tokenAddress)

      const [score, balance, count] = await Promise.all([
        hub.getReputationScore(address),
        getReputationBalance(tokenAddress, address),
        hub.getTransferCount().catch(() => 0n),
      ])

      const scoreStr = ethers.formatEther(score.toString())
      setReputationScore(parseFloat(scoreStr).toFixed(2))
      setTokenBalance(balance)

      const limit = Math.min(Number(count), 200)
      const feed = limit > 0 ? await hub.getFeed(limit, 0) : []
      const list: TransferRow[] = feed
        .map((t: any) => ({
          from: t.from,
          to: t.to,
          amount: BigInt(t.amount.toString()),
          message: t.message,
          timestamp: BigInt(t.timestamp.toString()),
          blockNumber: BigInt(t.blockNumber.toString()),
        }))
        .filter((t: TransferRow) => t.from.toLowerCase() === address.toLowerCase() || t.to.toLowerCase() === address.toLowerCase())
      list.sort((a, b) => (Number(b.timestamp) - Number(a.timestamp)))
      setTransfers(list.slice(0, 20))

      if (daoAddress) {
        const dao = getReputationDAOContract(daoAddress)
        const total = await dao.proposalCount().catch(() => 0n)
        const n = Math.min(Number(total), 50)
        const created: ProposalRow[] = []
        const votes: VoteRow[] = []

        for (let i = 1; i <= n; i++) {
          try {
            const p = await dao.getProposal(i)
            const proposer = (p.proposer || '').toLowerCase()
            const desc = p.description || ''
            const deadline = Number(p.deadline || 0)
            const votesFor = BigInt((p.votesFor || 0).toString())
            const votesAgainst = BigInt((p.votesAgainst || 0).toString())
            const createdAt = Number(p.createdAt || p.deadline || 0)

            if (proposer === address.toLowerCase()) {
              created.push({
                id: Number(p.id),
                description: desc,
                deadline,
                votesFor,
                votesAgainst,
                createdAt,
              })
            }

            const voted = await dao.hasVoted(i, address).catch(() => false)
            if (voted) {
              const amt = await dao.getVoteAmount(i, address).catch(() => 0n)
              votes.push({
                proposalId: i,
                description: desc,
                amount: BigInt(amt.toString()),
                support: true,
              })
            }
          } catch {
            // skip invalid proposal
          }
        }

        created.sort((a, b) => b.createdAt - a.createdAt)
        votes.sort((a, b) => b.proposalId - a.proposalId)
        setProposalsCreated(created.slice(0, 10))
        setVotesCast(votes.slice(0, 10))
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function checkWallet() {
      try {
        const { getCurrentAccount } = await import('@/lib/web3')
        const acc = await getCurrentAccount()
        setConnectedAddress(acc || null)
      } catch {
        setConnectedAddress(null)
      }
    }
    checkWallet()
  }, [])

  const formatAmount = (amount: bigint) => {
    try {
      return parseFloat(ethers.formatEther(amount.toString())).toFixed(2)
    } catch {
      return amount.toString()
    }
  }

  const isOwnProfile = !!address && !!connectedAddress &&
    address.toLowerCase() === connectedAddress.toLowerCase()

  if (error && !address) {
    return (
      <div className="min-h-screen p-8 md:p-24">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Invalid profile</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <Link href="/" className="text-blue-600 hover:underline">Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 md:p-24">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="mb-6 flex flex-wrap gap-4 justify-center">
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
          <Link href="/dao" className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium text-sm">
            DAO
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8">Profile</h1>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading profile...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg mb-6">
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        ) : address ? (
          <>
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  {getAddressDisplayName(address) ? (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Address</p>
                      <p className="text-lg font-semibold">{getAddressDisplayName(address)}</p>
                      <p className="font-mono text-gray-500 dark:text-gray-400 mt-1">
                        {formatAddress(address)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Address</p>
                      <p className="font-mono text-lg break-all">{address}</p>
                      <p className="font-mono text-gray-500 dark:text-gray-400 mt-1">
                        {formatAddress(address)}
                      </p>
                    </>
                  )}
                </div>
                {isOwnProfile && (
                  <span className="px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    Your profile
                  </span>
                )}
                {!isOwnProfile && connectedAddress && (
                  <Link
                    href={`/transfer?to=${encodeURIComponent(address)}`}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    Transfer REP to this address
                  </Link>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reputation score</p>
                <p className="text-2xl font-bold">{reputationScore} REP</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Token balance</p>
                <p className="text-2xl font-bold">{tokenBalance} REP</p>
              </div>
            </div>

            {/* Recent transfers */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Recent transfers</h2>
              {transfers.length === 0 ? (
                <p className="text-gray-500 text-sm">No transfers yet.</p>
              ) : (
                <ul className="space-y-3">
                  {transfers.map((t, i) => (
                    <li
                      key={`${t.from}-${t.to}-${t.timestamp}-${i}`}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        {t.from.toLowerCase() === address.toLowerCase() ? (
                          <>
                            <span className="text-gray-500">Sent</span>
                            <span className="font-mono">{formatAmount(t.amount)} REP</span>
                            <span className="text-gray-400">→</span>
                            <Link href={`/profile/${t.to}`} className="font-mono text-green-600 dark:text-green-400 hover:underline">
                              {formatAddressOrName(t.to)}
                            </Link>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500">Received</span>
                            <span className="font-mono">{formatAmount(t.amount)} REP</span>
                            <span className="text-gray-400">←</span>
                            <Link href={`/profile/${t.from}`} className="font-mono text-blue-600 dark:text-blue-400 hover:underline">
                              {formatAddressOrName(t.from)}
                            </Link>
                          </>
                        )}
                        <span className="text-gray-400 text-xs ml-auto">
                          {formatDate(Number(t.timestamp))}
                        </span>
                      </div>
                      {t.message && (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                          &quot;{t.message}&quot;
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {transfers.length > 0 && (
                <Link href="/feed" className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View full feed →
                </Link>
              )}
            </div>

            {/* DAO: proposals created */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Proposals created</h2>
              {proposalsCreated.length === 0 ? (
                <p className="text-gray-500 text-sm">No proposals created.</p>
              ) : (
                <ul className="space-y-3">
                  {proposalsCreated.map((p) => (
                    <li key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <Link href="/dao" className="font-medium text-purple-600 dark:text-purple-400 hover:underline">
                            #{p.id}
                          </Link>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{p.description}</p>
                          <p className="text-xs text-gray-500 mt-1">Deadline: {formatDate(p.deadline)}</p>
                        </div>
                        <div className="text-right text-sm">
                          <span className="text-green-600 dark:text-green-400">{formatAmount(p.votesFor)} for</span>
                          <span className="mx-1 text-gray-400">/</span>
                          <span className="text-red-600 dark:text-red-400">{formatAmount(p.votesAgainst)} against</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {proposalsCreated.length > 0 && (
                <Link href="/dao" className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View all proposals →
                </Link>
              )}
            </div>

            {/* DAO: votes cast */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Votes cast</h2>
              {votesCast.length === 0 ? (
                <p className="text-gray-500 text-sm">No votes cast.</p>
              ) : (
                <ul className="space-y-3">
                  {votesCast.map((v) => (
                    <li key={`${v.proposalId}-${v.amount}`} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <Link href="/dao" className="font-medium text-purple-600 dark:text-purple-400 hover:underline">
                            Proposal #{v.proposalId}
                          </Link>
                          <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-1">{v.description}</p>
                        </div>
                        <span className="font-mono text-sm">{formatAmount(v.amount)} REP</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {votesCast.length > 0 && (
                <Link href="/dao" className="inline-block mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  View DAO →
                </Link>
              )}
            </div>

            {/* FAQ */}
            <FAQ
              items={[
                {
                  question: 'What is a reputation profile?',
                  answer: 'Your profile shows your on-chain reputation score, REP token balance, recent reputation transfers (sent and received), and your DAO activity (proposals created and votes cast).',
                },
                {
                  question: 'How can I improve my reputation?',
                  answer: 'Reputation is calculated from transaction history, balance and activity, wallet age, and social activity. Mint reputation, transfer REP to others, and participate in DAO voting to grow your score.',
                },
                {
                  question: 'Can I transfer REP to someone from their profile?',
                  answer: 'Yes. If you are connected and viewing another user\'s profile, you\'ll see a "Transfer REP to this address" button that takes you to the transfer page with the recipient pre-filled.',
                },
              ]}
            />
          </>
        ) : null}
      </div>
    </div>
  )
}
