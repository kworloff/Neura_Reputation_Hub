# 🏆 Reputation Hub - EVM Hackathon Project

Децентрализованная платформа для оценки и управления репутацией кошельков в EVM сетях.

## 📋 Описание

Reputation Hub позволяет:
- 📊 Оценивать репутацию кошельков на основе их активности в сети
- 🪙 Получать токены репутации (ERC-20)
- 💬 Передавать репутацию другим пользователям с сообщениями
- 📰 Просматривать фид всех передач репутации
- 🗳️ Голосовать в DAO используя свою репутацию

## 🛠 Технологии

- **Smart Contracts**: Solidity ^0.8.20, Hardhat
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, ethers.js v6
- **Deployment**: Netlify (Frontend), Etherscan (Contracts)

## 🚀 Быстрый старт

### Установка зависимостей

```bash
# Root dependencies
npm install

# Contracts dependencies
cd contracts
npm install

# Frontend dependencies
cd ../frontend
npm install
```

### Настройка конфигурации

1. Скопируйте `config.example.json` в `config.json`
2. Создайте `.env` в корне (для деплоя контрактов): `PRIVATE_KEY`, `NEURA_RPC_URL`
3. В `frontend/` создайте `.env.local`:
   ```
   NEXT_PUBLIC_RPC_URL=https://rpc.ankr.com/neura_testnet
   NEXT_PUBLIC_CHAIN_ID=267
   NEXT_PUBLIC_CHAIN_NAME=Neura Testnet
   NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN=0x...
   NEXT_PUBLIC_CONTRACT_ADDRESS_HUB=0x...
   NEXT_PUBLIC_CONTRACT_ADDRESS_DAO=0x...
   ```
   Адреса контрактов берутся из `config.json` после деплоя.

### Деплой контрактов (Neura Testnet)

```bash
cd contracts
npx hardhat run scripts/deploy.js --network neura_testnet
```

После деплоя обновите адреса в `frontend/.env.local`.

### Запуск frontend

```bash
cd frontend
npm run dev
```

### Деплой на Netlify

1. Подключите репозиторий к Netlify
2. **Base directory:** `frontend`
3. **Build command:** `npm run build`
4. **Publish directory:** `.next` (или оставьте настройки из `frontend/netlify.toml`)
5. Добавьте переменные окружения: `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_CONTRACT_ADDRESS_*`

## 📁 Структура проекта

```
reputation-hub/
├── contracts/          # Solidity контракты
├── frontend/           # Next.js приложение
├── scripts/            # Скрипты деплоя
├── config/             # Конфигурация
└── tests/              # Тесты
```

## 📝 Документация

Подробный роудмап разработки смотрите в [road.md](./road.md)

## 🔐 Безопасность

⚠️ **Никогда не коммитьте приватные ключи или секретные данные в Git!**

## 📄 Лицензия

MIT
