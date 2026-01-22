import { ethers } from 'ethers';
import { getProvider } from './web3';
import { getReputationHubContract } from './contracts';

/**
 * Расчет репутации на основе активности кошелька
 * Согласно REPUTATION_CRITERIA.md
 */
export async function calculateWalletReputation(
  walletAddress: string,
  hubAddress?: string
): Promise<{
  score: number;
  breakdown: {
    transactionHistory: {
      count: number;
      regularity: number;
      diversity: number;
      total: number;
    };
    balanceActivity: {
      balance: number;
      stability: number;
      transfers: number;
      total: number;
    };
    walletAge: {
      days: number;
      score: number;
    };
    socialActivity: {
      reputationTransfers: number;
      daoParticipation: number;
      total: number;
    };
    bonuses: number;
    total: number;
  };
}> {
  const provider = getProvider();
  
  try {
    // 1. История транзакций (макс 180 баллов)
    const txHistory = await calculateTransactionHistory(walletAddress, provider);
    
    // 2. Баланс и активность (макс 120 баллов)
    const balanceActivity = await calculateBalanceActivity(walletAddress, provider);
    
    // 3. Возраст кошелька (макс 60 баллов)
    const walletAge = await calculateWalletAge(walletAddress, provider);
    
    // 4. Социальная активность (макс 30 баллов)
    const socialActivity = await calculateSocialActivity(walletAddress, hubAddress, provider);
    
    // Бонусы
    const bonuses = calculateBonuses(txHistory, walletAge);
    
    // Итоговый расчет
    const totalScore = Math.floor(
      txHistory.total * 0.46 +  // 46% от 390
      balanceActivity.total * 0.31 +  // 31% от 390
      walletAge.score * 0.15 +  // 15% от 390
      socialActivity.total * 0.08  // 8% от 390
    ) + bonuses;
    
    const finalScore = Math.min(totalScore, 390); // Максимум 390
    
    return {
      score: finalScore,
      breakdown: {
        transactionHistory: txHistory,
        balanceActivity,
        walletAge,
        socialActivity,
        bonuses,
        total: finalScore,
      },
    };
  } catch (error) {
    console.error('Error calculating reputation:', error);
    throw error;
  }
}

/**
 * Получение истории транзакций кошелька
 */
async function getTransactionHistory(
  walletAddress: string,
  provider: ethers.Provider,
  limit: number = 100
): Promise<Array<{ timestamp: number; to: string; from: string }>> {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 10000); // Последние ~10000 блоков
    
    // Получаем события Transfer для нативного токена (ETH/ANKR)
    const transferTopic = ethers.id('Transfer(address,address,uint256)');
    const addressTopic = ethers.zeroPadValue(walletAddress, 32);
    
    // Ищем входящие и исходящие переводы
    const [incomingLogs, outgoingLogs] = await Promise.all([
      provider.getLogs({
        topics: [
          transferTopic,
          null, // from
          addressTopic, // to
        ],
        fromBlock,
        toBlock: currentBlock,
      }).catch(() => []),
      provider.getLogs({
        topics: [
          transferTopic,
          addressTopic, // from
          null, // to
        ],
        fromBlock,
        toBlock: currentBlock,
      }).catch(() => []),
    ]);
    
    // Получаем блоки для временных меток
    const transactions: Array<{ timestamp: number; to: string; from: string }> = [];
    const processedBlocks = new Set<number>();
    
    for (const log of [...incomingLogs, ...outgoingLogs].slice(0, limit)) {
      if (!processedBlocks.has(log.blockNumber)) {
        try {
          const block = await provider.getBlock(log.blockNumber);
          if (block) {
            transactions.push({
              timestamp: block.timestamp,
              to: log.topics[2] ? ethers.getAddress('0x' + log.topics[2].slice(-40)) : '',
              from: log.topics[1] ? ethers.getAddress('0x' + log.topics[1].slice(-40)) : '',
            });
            processedBlocks.add(log.blockNumber);
          }
        } catch (e) {
          console.error('Error getting block:', e);
        }
      }
    }
    
    return transactions.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

/**
 * 1. Расчет истории транзакций (макс 180 баллов)
 */
async function calculateTransactionHistory(
  walletAddress: string,
  provider: ethers.Provider
): Promise<{
  count: number;
  regularity: number;
  diversity: number;
  total: number;
}> {
  const txCount = await provider.getTransactionCount(walletAddress, 'latest');
  
  // Количество транзакций (0-100 баллов)
  let countScore = 0;
  if (txCount === 0) {
    countScore = 0;
  } else if (txCount <= 10) {
    countScore = Math.floor((txCount / 10) * 20); // 0-20
  } else if (txCount <= 50) {
    countScore = 20 + Math.floor(((txCount - 10) / 40) * 30); // 21-50
  } else if (txCount <= 100) {
    countScore = 50 + Math.floor(((txCount - 50) / 50) * 25); // 51-75
  } else {
    countScore = 75 + Math.min(Math.floor((txCount - 100) / 10), 25); // 76-100
  }
  countScore = Math.min(countScore, 100);
  
  // Регулярность транзакций (0-50 баллов)
  let regularityScore = 0;
  if (txCount > 0) {
    try {
      // Получаем историю транзакций для анализа регулярности
      const transactions = await getTransactionHistory(walletAddress, provider, 50);
      
      if (transactions.length > 1) {
        // Анализируем временные интервалы между транзакциями
        const intervals: number[] = [];
        for (let i = 1; i < transactions.length; i++) {
          const interval = transactions[i].timestamp - transactions[i - 1].timestamp;
          intervals.push(interval);
        }
        
        // Вычисляем средний интервал и стандартное отклонение
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => {
          return sum + Math.pow(interval - avgInterval, 2);
        }, 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = avgInterval > 0 ? stdDev / avgInterval : 1;
        
        // Низкий коэффициент вариации = равномерное распределение
        if (coefficientOfVariation < 0.5) {
          regularityScore = 50; // Равномерное распределение
        } else if (coefficientOfVariation < 1.0) {
          regularityScore = 35; // Умеренная регулярность
        } else {
          regularityScore = 20; // Концентрированные транзакции
        }
      } else if (transactions.length === 1) {
        regularityScore = 10; // Редкие транзакции
      }
    } catch (e) {
      console.error('Error calculating regularity:', e);
      // Fallback на упрощенную версию
      if (txCount > 50) {
        regularityScore = 50;
      } else if (txCount > 20) {
        regularityScore = 35;
      } else {
        regularityScore = 20;
      }
    }
  }
  
  // Разнообразие взаимодействий (0-30 баллов)
  let diversityScore = 0;
  if (txCount > 0) {
    try {
      // Получаем историю транзакций для анализа разнообразия
      const transactions = await getTransactionHistory(walletAddress, provider, 100);
      
      // Подсчитываем уникальные адреса контрактов/получателей
      const uniqueAddresses = new Set<string>();
      transactions.forEach(tx => {
        if (tx.to && tx.to !== walletAddress.toLowerCase()) {
          uniqueAddresses.add(tx.to.toLowerCase());
        }
        if (tx.from && tx.from !== walletAddress.toLowerCase()) {
          uniqueAddresses.add(tx.from.toLowerCase());
        }
      });
      
      const uniqueCount = uniqueAddresses.size;
      
      if (uniqueCount > 10) {
        diversityScore = 30; // Взаимодействие с разными контрактами
      } else if (uniqueCount >= 5) {
        diversityScore = 20; // 5-10 контрактов
      } else if (uniqueCount >= 1) {
        diversityScore = 10; // 1-4 контракта
      }
    } catch (e) {
      console.error('Error calculating diversity:', e);
      // Fallback на упрощенную версию
      if (txCount > 50) {
        diversityScore = 30;
      } else if (txCount > 20) {
        diversityScore = 20;
      } else {
        diversityScore = 10;
      }
    }
  }
  
  const total = countScore + regularityScore + diversityScore;
  
  return {
    count: countScore,
    regularity: regularityScore,
    diversity: diversityScore,
    total: Math.min(total, 180),
  };
}

/**
 * Получение истории баланса
 */
async function getBalanceHistory(
  walletAddress: string,
  provider: ethers.Provider
): Promise<Array<{ block: number; balance: bigint; timestamp: number }>> {
  try {
    const currentBlock = await provider.getBlockNumber();
    const sampleBlocks = 10; // Берем 10 точек за последние блоки
    const step = Math.max(1, Math.floor((currentBlock - Math.max(0, currentBlock - 10000)) / sampleBlocks));
    
    const balanceHistory: Array<{ block: number; balance: bigint; timestamp: number }> = [];
    
    for (let i = 0; i < sampleBlocks; i++) {
      const blockNumber = currentBlock - (i * step);
      if (blockNumber < 0) break;
      
      try {
        const block = await provider.getBlock(blockNumber);
        if (block) {
          const balance = await provider.getBalance(walletAddress, blockNumber);
          balanceHistory.push({
            block: blockNumber,
            balance,
            timestamp: block.timestamp,
          });
        }
      } catch (e) {
        console.error(`Error getting balance for block ${blockNumber}:`, e);
      }
    }
    
    return balanceHistory.reverse(); // От старых к новым
  } catch (error) {
    console.error('Error getting balance history:', error);
    return [];
  }
}

/**
 * 2. Расчет баланса и активности (макс 120 баллов)
 */
async function calculateBalanceActivity(
  walletAddress: string,
  provider: ethers.Provider
): Promise<{
  balance: number;
  stability: number;
  transfers: number;
  total: number;
}> {
  const balance = await provider.getBalance(walletAddress);
  const balanceAnkr = parseFloat(ethers.formatEther(balance));
  
  // Баланс ANKR (0-60 баллов)
  let balanceScore = 0;
  if (balanceAnkr === 0) {
    balanceScore = 0;
  } else if (balanceAnkr >= 1 && balanceAnkr < 50) {
    balanceScore = 10;
  } else if (balanceAnkr >= 50 && balanceAnkr < 200) {
    balanceScore = 20;
  } else if (balanceAnkr >= 200 && balanceAnkr < 500) {
    balanceScore = 40;
  } else if (balanceAnkr >= 500 && balanceAnkr <= 1000) {
    balanceScore = 60;
  } else if (balanceAnkr > 1000) {
    balanceScore = 60; // Максимум
  }
  
  // Стабильность баланса (0-40 баллов)
  let stabilityScore = 0;
  if (balanceAnkr > 0) {
    try {
      const balanceHistory = await getBalanceHistory(walletAddress, provider);
      
      if (balanceHistory.length > 1) {
        // Вычисляем изменения баланса
        const changes: number[] = [];
        for (let i = 1; i < balanceHistory.length; i++) {
          const prevBalance = parseFloat(ethers.formatEther(balanceHistory[i - 1].balance));
          const currBalance = parseFloat(ethers.formatEther(balanceHistory[i].balance));
          if (prevBalance > 0) {
            const change = Math.abs((currBalance - prevBalance) / prevBalance) * 100;
            changes.push(change);
          }
        }
        
        if (changes.length > 0) {
          const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
          
          if (avgChange < 10) {
            stabilityScore = 40; // Стабильный баланс (<10% изменений)
          } else if (avgChange < 50) {
            stabilityScore = 25; // Умеренные изменения (10-50%)
          } else {
            stabilityScore = 10; // Высокая волатильность (>50%)
          }
        } else {
          stabilityScore = 25; // Fallback
        }
      } else {
        stabilityScore = 25; // Недостаточно данных
      }
    } catch (e) {
      console.error('Error calculating stability:', e);
      stabilityScore = 25; // Fallback
    }
  }
  
  // Активность переводов (0-20 баллов)
  const txCount = await provider.getTransactionCount(walletAddress, 'latest');
  let transfersScore = 0;
  
  try {
    // Получаем реальные переводы из истории
    const transactions = await getTransactionHistory(walletAddress, provider, 50);
    const transferCount = transactions.length;
    
    if (transferCount > 30) {
      transfersScore = 20; // Регулярные переводы
    } else if (transferCount > 10) {
      transfersScore = 10; // Периодические переводы
    } else if (transferCount > 0) {
      transfersScore = 5; // Редкие переводы
    }
  } catch (e) {
    console.error('Error calculating transfers:', e);
    // Fallback на количество транзакций
    if (txCount > 50) {
      transfersScore = 20;
    } else if (txCount > 20) {
      transfersScore = 10;
    } else if (txCount > 0) {
      transfersScore = 5;
    }
  }
  
  const total = balanceScore + stabilityScore + transfersScore;
  
  return {
    balance: balanceScore,
    stability: stabilityScore,
    transfers: transfersScore,
    total: Math.min(total, 120),
  };
}

/**
 * 3. Расчет возраста кошелька (макс 60 баллов)
 */
async function calculateWalletAge(
  walletAddress: string,
  provider: ethers.Provider
): Promise<{
  days: number;
  score: number;
}> {
  try {
    const txCount = await provider.getTransactionCount(walletAddress, 'latest');
    
    if (txCount === 0) {
      return { days: 0, score: 0 };
    }
    
    // Пытаемся найти первую транзакцию через историю
    let firstTxTimestamp: number | null = null;
    try {
      const transactions = await getTransactionHistory(walletAddress, provider, 1);
      if (transactions.length > 0) {
        firstTxTimestamp = transactions[0].timestamp;
      }
    } catch (e) {
      console.error('Error getting first transaction:', e);
    }
    
    let days = 0;
    
    if (firstTxTimestamp) {
      // Используем реальную временную метку первой транзакции
      const currentTime = Math.floor(Date.now() / 1000);
      days = Math.floor((currentTime - firstTxTimestamp) / (60 * 60 * 24));
    } else {
      // Fallback: приблизительный расчет на основе блоков
      const currentBlock = await provider.getBlockNumber();
      const blocksPerDay = (60 * 60 * 24) / 12; // ~7200 блоков в день
      days = Math.floor(currentBlock / blocksPerDay);
    }
    
    // Время существования (0-60 баллов)
    let ageScore = 0;
    
    if (days < 90) { // <3 месяцев
      ageScore = 5;
    } else if (days < 180) { // 3-6 месяцев
      ageScore = 15;
    } else if (days < 365) { // 6-12 месяцев
      ageScore = 30;
    } else if (days < 730) { // 1-2 года
      ageScore = 45;
    } else { // >2 лет
      ageScore = 60;
    }
    
    return {
      days,
      score: ageScore,
    };
  } catch (e) {
    console.error('Error calculating wallet age:', e);
    return { days: 0, score: 0 };
  }
}

/**
 * 4. Расчет социальной активности (макс 30 баллов)
 */
async function calculateSocialActivity(
  walletAddress: string,
  hubAddress: string | undefined,
  provider: ethers.Provider
): Promise<{
  reputationTransfers: number;
  daoParticipation: number;
  total: number;
}> {
  let reputationTransfersScore = 0;
  let daoParticipationScore = 0;
  
  // Передача репутации другим (0-20 баллов)
  // Получение репутации от других (0-10 баллов)
  if (hubAddress) {
    try {
      const hubContract = getReputationHubContract(hubAddress);
      // Получаем количество передач из фида
      const feed = await hubContract.getFeed(100, 0);
      
      let sentCount = 0;
      let receivedCount = 0;
      
      for (const transfer of feed) {
        if (transfer.from.toLowerCase() === walletAddress.toLowerCase()) {
          sentCount++;
        }
        if (transfer.to.toLowerCase() === walletAddress.toLowerCase()) {
          receivedCount++;
        }
      }
      
      if (sentCount > 0) {
        reputationTransfersScore = 20; // Передача репутации
      } else if (receivedCount > 0) {
        reputationTransfersScore = 10; // Получение репутации
      }
    } catch (e) {
      console.error('Error getting reputation transfers:', e);
    }
  }
  
  // Участие в DAO (0-10 баллов)
  // TODO: Реализовать проверку участия в DAO через контракт
  // Пока оставляем 0
  
  const total = reputationTransfersScore + daoParticipationScore;
  
  return {
    reputationTransfers: reputationTransfersScore,
    daoParticipation: daoParticipationScore,
    total: Math.min(total, 30),
  };
}

/**
 * Расчет бонусов
 */
function calculateBonuses(
  txHistory: { count: number; regularity: number; diversity: number; total: number },
  walletAge: { days: number; score: number }
): number {
  let bonuses = 0;
  
  // Активность в течение последних 30 дней (если есть транзакции)
  if (txHistory.count > 0) {
    bonuses += 15;
  }
  
  // Долгосрочное хранение (>1 года)
  if (walletAge.days > 365) {
    bonuses += 20;
  }
  
  return bonuses;
}

/**
 * Получение баланса токенов репутации
 */
export async function getReputationBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  const provider = getProvider();
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ['function balanceOf(address) view returns (uint256)'],
    provider
  );
  
  try {
    const balance = await tokenContract.balanceOf(walletAddress);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error getting reputation balance:', error);
    return '0';
  }
}

/**
 * Получение репутационного счета из контракта
 */
export async function getReputationScore(
  hubAddress: string,
  walletAddress: string
): Promise<string> {
  const provider = getProvider();
  const hubContract = new ethers.Contract(
    hubAddress,
    ['function getReputationScore(address) view returns (uint256)'],
    provider
  );
  
  try {
    const score = await hubContract.getReputationScore(walletAddress);
    // Контракт может возвращать значение в wei, конвертируем в ether
    // Но так как это репутация, а не токены, просто возвращаем как есть
    // Если значение слишком большое (вероятно в wei), делим на 10^18
    const scoreBigInt = BigInt(score.toString());
    if (scoreBigInt > BigInt(10 ** 15)) {
      // Если больше 10^15, вероятно в wei формате
      return ethers.formatEther(score.toString());
    }
    return score.toString();
  } catch (error) {
    console.error('Error getting reputation score:', error);
    return '0';
  }
}
