# 🔧 Netlify Environment Variables

Убедитесь, что в настройках Netlify (Site settings → Environment variables) установлены следующие переменные:

## Обязательные переменные окружения для Netlify:

```
NEXT_PUBLIC_RPC_URL=https://rpc.ankr.com/neura_testnet
NEXT_PUBLIC_CHAIN_ID=267
NEXT_PUBLIC_CHAIN_NAME=Neura Testnet
NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN=0x5C886b66ce486c835a84D23A268556B069584908
NEXT_PUBLIC_CONTRACT_ADDRESS_HUB=0xF0516E78FAAde7afeA086997aE274c68f1Cdaa35
NEXT_PUBLIC_CONTRACT_ADDRESS_DAO=0xed6392A2C9857B004fAe2600a91543D28cF9C021
```

## Как добавить переменные в Netlify:

1. Откройте ваш сайт в [Netlify Dashboard](https://app.netlify.com)
2. Перейдите в **Site settings** → **Environment variables**
3. Нажмите **Add variable** для каждой переменной выше
4. После добавления всех переменных, перезапустите деплой:
   - **Deploys** → выберите последний деплой → **Trigger deploy** → **Deploy site**

## Проверка подключения контрактов:

✅ Контракты задеплоены с функцией autoMintReputation (все пользователи могут минтить репутацию):
- ReputationToken: `0x5C886b66ce486c835a84D23A268556B069584908`
- ReputationHub: `0xF0516E78FAAde7afeA086997aE274c68f1Cdaa35`
- ReputationDAO: `0xed6392A2C9857B004fAe2600a91543D28cF9C021`

Если контракты не работают на сайте, убедитесь, что:
1. Все переменные окружения установлены в Netlify
2. Переменные начинаются с `NEXT_PUBLIC_` (иначе они не будут доступны в браузере)
3. После изменения переменных перезапущен деплой
