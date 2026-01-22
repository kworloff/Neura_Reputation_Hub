import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Специальные адреса с отображаемыми именами */
const ADDRESS_LABELS: Record<string, string> = {
  '0x4971bcabd6641114ed880124bbdafa509293a0c7': 'Founder of Neura Reputation Hub',
};

/**
 * Возвращает отображаемое имя для известного адреса или null
 */
export function getAddressDisplayName(address: string): string | null {
  if (!address) return null;
  const key = address.toLowerCase();
  return ADDRESS_LABELS[key] ?? null;
}

/**
 * Форматирование адреса кошелька
 */
export function formatAddress(address: string, length: number = 6): string {
  if (!address) return '';
  if (address.length <= length * 2) return address;
  return `${address.slice(0, length)}...${address.slice(-length)}`;
}

/**
 * Адрес или отображаемое имя (для известных адресов), иначе форматированный адрес
 */
export function formatAddressOrName(address: string, length: number = 6): string {
  const name = getAddressDisplayName(address);
  if (name) return name;
  return formatAddress(address, length);
}

/**
 * Форматирование числа (wei -> ether)
 */
export function formatEther(value: bigint | string): string {
  const num = typeof value === 'string' ? BigInt(value) : value;
  const divisor = BigInt(10 ** 18);
  const whole = num / divisor;
  const remainder = num % divisor;
  
  if (remainder === BigInt(0)) {
    return whole.toString();
  }
  
  const decimals = remainder.toString().padStart(18, '0');
  const trimmed = decimals.replace(/\.?0+$/, '');
  
  return `${whole}.${trimmed}`;
}

/**
 * Форматирование даты
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** URL эксплорера Neura Testnet */
const NEURA_EXPLORER = 'https://testnet-blockscout.infra.neuraprotocol.io';

/**
 * Получение ссылки на блокчейн эксплорер
 */
export function getEtherscanLink(
  addressOrHash: string,
  network: string = 'neura_testnet',
  type: 'address' | 'tx' | 'block' = 'address'
): string {
  if (network === 'neura_testnet') {
    const path = type === 'tx' ? 'tx' : type === 'block' ? 'block' : 'address';
    return `${NEURA_EXPLORER}/${path}/${addressOrHash}`;
  }
  const baseUrl = network === 'sepolia'
    ? 'https://sepolia.etherscan.io'
    : 'https://etherscan.io';
  const path = type === 'tx' ? 'tx' : type === 'block' ? 'block' : 'address';
  return `${baseUrl}/${path}/${addressOrHash}`;
}
