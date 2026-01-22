'use client'

import { useState, useEffect } from 'react'
import { connectWallet, getCurrentAccount, checkNetwork, switchNetwork } from '@/lib/web3'
import { formatAddressOrName } from '@/lib/utils'

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chainId = process.env.NEXT_PUBLIC_CHAIN_ID || '267'
  const chainName = process.env.NEXT_PUBLIC_CHAIN_NAME || 'Neura Testnet'
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://rpc.ankr.com/neura_testnet'

  useEffect(() => {
    // Проверяем подключенный кошелек при загрузке
    checkConnectedWallet()
    
    // Слушаем изменения аккаунта
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
      
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  const checkConnectedWallet = async () => {
    try {
      const account = await getCurrentAccount()
      if (account) {
        setAddress(account)
        await ensureCorrectNetwork()
      }
    } catch (err) {
      console.error('Error checking wallet:', err)
    }
  }

  const handleAccountsChanged = (accounts: string[]) => {
    if (accounts.length === 0) {
      setAddress(null)
    } else {
      setAddress(accounts[0])
    }
  }

  const handleChainChanged = () => {
    window.location.reload()
  }

  const ensureCorrectNetwork = async () => {
    try {
      const isCorrectNetwork = await checkNetwork(chainId)
      if (!isCorrectNetwork) {
        // Пытаемся переключить сеть, но не блокируем подключение
        await switchNetwork(chainId, chainName, rpcUrl)
      }
    } catch (err: any) {
      console.error('Error switching network:', err)
      // Можно показать предупреждение, но не критическую ошибку
      if (err.message && !err.message.includes('rejected')) {
        setError(`Warning: ${err.message}`)
      }
    }
  }

  const handleConnect = async () => {
    setIsConnecting(true)
    setError(null)
    
    try {
      // Сначала подключаем кошелек
      const { address: connectedAddress } = await connectWallet()
      setAddress(connectedAddress)
      
      // Проверяем и переключаем сеть асинхронно (не блокируя UI)
      ensureCorrectNetwork().catch(err => {
        console.error('Network switch error:', err)
        // Не показываем ошибку сети как критическую, просто логируем
      })
    } catch (err: any) {
      // Обрабатываем ошибки подключения
      if (err.code === 4001) {
        setError('Connection rejected by user')
      } else if (err.code === -32002) {
        setError('Connection request already pending')
      } else {
        setError(err.message || 'Failed to connect wallet')
      }
      console.error('Connection error:', err)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    setAddress(null)
    setError(null)
  }

  if (address) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-green-100 dark:bg-green-900 rounded-lg">
            <span className="text-sm font-medium text-green-800 dark:text-green-200">
              Connected: {formatAddressOrName(address)}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Disconnect
          </button>
        </div>
        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleConnect}
        disabled={isConnecting}
        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && (
        <p className="text-red-500 text-sm max-w-md text-center">{error}</p>
      )}
    </div>
  )
}
