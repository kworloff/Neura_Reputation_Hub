# Reputation Hub - Frontend

Next.js приложение для Reputation Hub.

## Установка

```bash
npm install
```

## Разработка

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Сборка

```bash
npm run build
```

## Деплой на Netlify

1. Подключите репозиторий к Netlify
2. Настройте переменные окружения в Netlify Dashboard
3. Деплой произойдет автоматически при push в main ветку

Или используйте Netlify CLI:

```bash
netlify deploy --prod
```

## Переменные окружения

Создайте `.env.local` файл:

```env
NEXT_PUBLIC_RPC_URL=your_rpc_url
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_CONTRACT_ADDRESS_HUB=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN=0x...
NEXT_PUBLIC_CONTRACT_ADDRESS_DAO=0x...
```
