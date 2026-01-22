'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { getCurrentAccount } from '@/lib/web3'

const WalletConnect = dynamic(
  () => import('@/components/web3/WalletConnect'),
  { ssr: false }
)

export default function Home() {
  const [address, setAddress] = useState<string | null>(null)

  useEffect(() => {
    getCurrentAccount().then(setAddress)
    const interval = setInterval(() => getCurrentAccount().then(setAddress), 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          🏆 Neura Reputation Hub
        </h1>
        <p className="text-center text-lg mb-4">
          Decentralized reputation platform for managing wallet reputation
        </p>
        <div className="mt-8 text-center">
          <WalletConnect />
        </div>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          {address && (
            <Link
              href={`/profile/${address}`}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-medium"
            >
              My profile
            </Link>
          )}
          <Link
            href="/mint"
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
          >
            Mint Reputation
          </Link>
          <Link
            href="/transfer"
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors font-medium"
          >
            Transfer Reputation
          </Link>
          <Link
            href="/feed"
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors font-medium"
          >
            View Feed
          </Link>
          <Link
            href="/dao"
            className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors font-medium"
          >
            DAO
          </Link>
        </div>
      </div>
    </main>
  )
}
