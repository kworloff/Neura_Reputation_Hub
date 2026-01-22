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

1. Запушьте код в **публичный** репозиторий (GitHub / GitLab).
2. В [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → выберите репозиторий.
3. Настройки сборки:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** оставьте по умолчанию (используется `frontend/netlify.toml` и плагин Next.js).
4. **Environment variables** (Site settings → Environment variables):
   - `NEXT_PUBLIC_RPC_URL` = `https://rpc.ankr.com/neura_testnet`
   - `NEXT_PUBLIC_CHAIN_ID` = `267`
   - `NEXT_PUBLIC_CHAIN_NAME` = `Neura Testnet`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN` = адрес из `config.json`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_HUB` = адрес из `config.json`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_DAO` = адрес из `config.json`
5. **Deploy**.

## 📁 Структура проекта

```
├── contracts/          # Solidity контракты, скрипты деплоя, тесты
├── frontend/           # Next.js приложение (деплой на Netlify)
├── config.example.json
├── README.md
└── ...
```

## 📝 Документация

Подробный роудмап разработки смотрите в [road.md](./road.md)

## 🔐 Безопасность

⚠️ **Никогда не коммитьте приватные ключи или секретные данные в Git!**

## 📄 Лицензия

MIT
