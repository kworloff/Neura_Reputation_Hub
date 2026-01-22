import { ethers } from 'ethers';

// Типы для window.ethereum
declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Инициализация провайдера Web3
 */
export function getProvider() {
  if (typeof window !== 'undefined' && window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  }
  // Fallback на RPC провайдер
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
  if (rpcUrl) {
    return new ethers.JsonRpcProvider(rpcUrl);
  }
  throw new Error('No Web3 provider found');
}

/**
 * Подключение кошелька
 */
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  try {
    // Используем прямой вызов для более надежного подключения
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];
    
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    return {
      address: accounts[0],
      provider,
      signer,
    };
  } catch (error: any) {
    // Пробрасываем ошибку с оригинальным кодом
    throw error;
  }
}

/**
 * Получение текущего аккаунта
 */
export async function getCurrentAccount() {
  if (!window.ethereum) {
    return null;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send('eth_accounts', []);
  
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Проверка подключенной сети
 */
export async function checkNetwork(chainId: string) {
  if (!window.ethereum) {
    return false;
  }

  try {
    const chainIdHex = await window.ethereum.request({
      method: 'eth_chainId',
    }) as string;
    
    const currentChainId = parseInt(chainIdHex, 16).toString();
    return currentChainId === chainId;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Переключение сети
 */
export async function switchNetwork(chainId: string, chainName: string, rpcUrl: string) {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed');
  }

  const chainIdHex = `0x${parseInt(chainId).toString(16)}`;

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchError: any) {
    // Если сеть не добавлена, добавляем её
    if (switchError.code === 4902 || switchError.code === -32603) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: chainIdHex,
              chainName,
              nativeCurrency: {
                name: 'ANKR',
                symbol: 'ANKR',
                decimals: 18,
              },
              rpcUrls: [rpcUrl],
              blockExplorerUrls: [],
            },
          ],
        });
      } catch (addError: any) {
        // Если пользователь отклонил добавление сети
        if (addError.code === 4001) {
          throw new Error('Network addition rejected by user');
        }
        throw new Error('Failed to add network: ' + (addError.message || 'Unknown error'));
      }
    } else if (switchError.code === 4001) {
      // Пользователь отклонил переключение
      throw new Error('Network switch rejected by user');
    } else {
      throw switchError;
    }
  }
}
