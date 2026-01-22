# Reputation Hub - Smart Contracts

Смарт-контракты для платформы Reputation Hub.

## Контракты

- **ReputationToken.sol** - ERC-20 токен репутации
- **ReputationHub.sol** - Основной контракт для управления репутацией
- **ReputationDAO.sol** - DAO контракт для голосования

## Установка

```bash
npm install
```

## Компиляция

```bash
npx hardhat compile
```

## Тестирование

```bash
npx hardhat test
```

## Деплой

```bash
# Локальная сеть
npx hardhat run scripts/deploy.js --network localhost

# Sepolia тестовая сеть
npx hardhat run scripts/deploy.js --network sepolia
```

## Верификация

После деплоя контракты можно верифицировать на Etherscan:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```
