# 🚀 Roadmap: Reputation Hub - EVM Hackathon Project

## 📋 Описание проекта

**Reputation Hub** - децентрализованная платформа для оценки и управления репутацией кошельков в EVM сетях. Пользователи получают токены репутации на основе их активности в сети, могут передавать их другим с сообщениями и использовать для голосования в DAO.

---

## 🎯 Основные функции

1. **Оценка кошелька** - анализ активности и транзакций
2. **Токены репутации** - ERC-20/ERC-721 токены репутации
3. **Передача репутации** - отправка токенов с сообщениями
4. **Фид активности** - лента всех передач репутации
5. **DAO голосование** - использование репутации для голосования

---

## 📅 Этапы разработки

### Phase 1: Подготовка и архитектура (День 1-2)

#### 1.1 Настройка проекта
- [ ] Инициализация монорепозитория
- [ ] Настройка структуры папок:
  ```
  reputation-hub/
  ├── contracts/          # Solidity контракты
  ├── frontend/           # Next.js приложение
  ├── scripts/            # Скрипты деплоя
  ├── config/             # Конфигурация
  └── tests/              # Тесты
  ```
- [ ] Настройка Git и .gitignore
- [ ] Создание README.md

#### 1.2 Выбор технологий
- **Frontend**: Next.js 14+ (App Router) для Netlify
- **Web3**: ethers.js v6
- **Blockchain**: EVM-совместимая сеть (Sepolia/Base/Arbitrum)
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand или React Context
- **Deployment**: Netlify (Frontend) + Hardhat/Foundry (Contracts)

#### 1.3 Дизайн архитектуры
- [ ] Схема смарт-контрактов
- [ ] Диаграмма взаимодействия компонентов
- [ ] API структура (если нужен backend)

---

### Phase 2: Смарт-контракты (День 2-4)

#### 2.1 ReputationToken Contract (ERC-20)
- [ ] Создание базового ERC-20 контракта
- [ ] Функции:
  - `mint(address to, uint256 amount)` - минт репутации
  - `burn(address from, uint256 amount)` - сжигание
  - `transferWithMessage(address to, uint256 amount, string message)` - передача с сообщением
- [ ] События для отслеживания передач
- [ ] Access control (только Hub контракт может минтить)

#### 2.2 ReputationHub Contract
- [ ] Основной контракт хаба
- [ ] Функции:
  - `calculateReputation(address wallet)` - расчет репутации
  - `mintReputation(address wallet)` - выдача репутации
  - `transferReputation(address to, uint256 amount, string message)` - передача
  - `getReputationScore(address wallet)` - получение счета
  - `getFeed(uint256 limit, uint256 offset)` - получение фида
- [ ] Хранение сообщений и истории передач
- [ ] Интеграция с Chainlink для оракулов (опционально)

#### 2.3 ReputationDAO Contract
- [ ] Контракт для DAO голосования
- [ ] Функции:
  - `createProposal(string description, uint256 deadline)` - создание предложения
  - `vote(uint256 proposalId, bool support, uint256 reputationAmount)` - голосование
  - `getProposal(uint256 proposalId)` - получение информации
- [ ] Взвешенное голосование по количеству репутации

#### 2.4 Тестирование контрактов
- [ ] Unit тесты (Hardhat/Foundry)
- [ ] Интеграционные тесты
- [ ] Тесты безопасности (reentrancy, overflow и т.д.)
- [ ] Gas оптимизация

#### 2.5 Деплой контрактов
- [ ] Скрипты деплоя для тестовой сети
- [ ] Верификация контрактов на Etherscan
- [ ] Сохранение адресов в config.json

---

### Phase 3: Frontend - Базовая структура (День 4-5)

#### 3.1 Инициализация Next.js
- [ ] Создание Next.js проекта с App Router
- [ ] Настройка Tailwind CSS
- [ ] Установка shadcn/ui компонентов
- [ ] Настройка для Netlify деплоя

#### 3.2 Web3 интеграция
- [ ] Настройка ethers.js
- [ ] Создание Web3 провайдера контекста
- [ ] Функции подключения кошелька (MetaMask, WalletConnect)
- [ ] Обработка смены сети

#### 3.3 Базовая структура страниц
- [ ] Layout компонент
- [ ] Главная страница (`/`)
- [ ] Страница профиля (`/profile/[address]`)
- [ ] Страница фида (`/feed`)
- [ ] Страница DAO (`/dao`)
- [ ] Страница передачи (`/transfer`)

#### 3.4 UI компоненты
- [ ] Header с подключением кошелька
- [ ] Карточка репутации
- [ ] Форма передачи репутации
- [ ] Компонент фида
- [ ] Компонент голосования DAO

---

### Phase 4: Функционал оценки кошелька (День 5-6)

#### 4.1 Анализ кошелька
- [ ] Интеграция с RPC для получения данных:
  - История транзакций
  - Баланс токенов
  - Взаимодействие с DeFi протоколами
  - NFT коллекции
  - Возраст кошелька
- [ ] Алгоритм расчета репутации:
  ```
  Score = (TransactionCount * 0.3) + 
          (TokenBalance * 0.2) + 
          (DeFiActivity * 0.3) + 
          (WalletAge * 0.1) + 
          (NFTCount * 0.1)
  ```

#### 4.2 API/Сервис для анализа
- [ ] Создание сервиса анализа (может быть serverless функция на Netlify)
- [ ] Кэширование результатов
- [ ] Обновление репутации периодически

#### 4.3 UI для отображения репутации
- [ ] Компонент счета репутации
- [ ] График истории репутации
- [ ] Детали расчета (breakdown)

---

### Phase 5: Система передачи репутации (День 6-7)

#### 5.1 Функционал передачи
- [ ] Форма передачи с валидацией
- [ ] Интеграция с `transferWithMessage` контрактом
- [ ] Обработка транзакций (pending, success, error)
- [ ] Toast уведомления

#### 5.2 Фид активности
- [ ] Компонент фида с пагинацией
- [ ] Отображение:
  - Отправитель
  - Получатель
  - Количество репутации
  - Сообщение
  - Время транзакции
  - Ссылка на Etherscan
- [ ] Фильтры и сортировка
- [ ] Real-time обновления (через события контракта)

#### 5.3 История передач
- [ ] Страница истории для пользователя
- [ ] Входящие/исходящие передачи
- [ ] Статистика

---

### Phase 6: DAO функционал (День 7-8)

#### 6.1 Создание предложений
- [ ] Форма создания предложения
- [ ] Валидация и деплой в контракт
- [ ] Отображение активных предложений

#### 6.2 Голосование
- [ ] Компонент голосования
- [ ] Выбор количества репутации для голоса
- [ ] Подтверждение транзакции
- [ ] Отображение результатов в реальном времени

#### 6.3 Управление предложениями
- [ ] Страница деталей предложения
- [ ] История голосов
- [ ] Статистика голосования
- [ ] Автоматическое закрытие по дедлайну

---

### Phase 7: Полировка и оптимизация (День 8-9)

#### 7.1 UX улучшения
- [ ] Loading states
- [ ] Error handling
- [ ] Empty states
- [ ] Анимации и transitions
- [ ] Responsive дизайн

#### 7.2 Производительность
- [ ] Оптимизация изображений
- [ ] Code splitting
- [ ] Lazy loading
- [ ] Кэширование данных
- [ ] Оптимизация RPC запросов

#### 7.3 Безопасность
- [ ] Валидация всех входных данных
- [ ] Защита от XSS
- [ ] Проверка адресов кошельков
- [ ] Обработка ошибок контрактов

---

### Phase 8: Деплой на Netlify (День 9-10)

#### 8.1 Подготовка к деплою
- [ ] Создание `netlify.toml`:
  ```toml
  [build]
    command = "npm run build"
    publish = ".next"
  
  [[plugins]]
    package = "@netlify/plugin-nextjs"
  
  [build.environment]
    NEXT_PUBLIC_RPC_URL = "your-rpc-url"
    NEXT_PUBLIC_CONTRACT_ADDRESS = "contract-address"
    NEXT_PUBLIC_CHAIN_ID = "11155111"
  ```
- [ ] Настройка переменных окружения в Netlify
- [ ] Проверка сборки локально

#### 8.2 Деплой контрактов
- [ ] Деплой в тестовую сеть (Sepolia/Base Sepolia)
- [ ] Верификация на Etherscan
- [ ] Обновление адресов в конфиге

#### 8.3 Деплой Frontend
- [ ] Подключение репозитория к Netlify
- [ ] Настройка build settings
- [ ] Деплой и проверка
- [ ] Настройка кастомного домена (опционально)

#### 8.4 Финальное тестирование
- [ ] E2E тестирование на проде
- [ ] Проверка всех функций
- [ ] Тестирование на разных сетях
- [ ] Проверка мобильной версии

---

## 🛠 Технический стек

### Smart Contracts
- **Solidity** ^0.8.20
- **Hardhat** или **Foundry**
- **OpenZeppelin** (ERC-20, Access Control)

### Frontend
- **Next.js** 14+ (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui**
- **ethers.js** v6
- **Zustand** (state management)
- **React Query** (data fetching)

### Deployment
- **Netlify** (Frontend)
- **Etherscan** (Contract verification)
- **IPFS** (опционально для метаданных)

---

## 📦 Структура проекта

```
reputation-hub/
├── contracts/
│   ├── ReputationToken.sol
│   ├── ReputationHub.sol
│   ├── ReputationDAO.sol
│   ├── interfaces/
│   └── scripts/
│       ├── deploy.js
│       └── verify.js
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── profile/
│   │   ├── feed/
│   │   ├── dao/
│   │   └── transfer/
│   ├── components/
│   │   ├── web3/
│   │   ├── reputation/
│   │   ├── feed/
│   │   └── dao/
│   ├── lib/
│   │   ├── web3.ts
│   │   ├── contracts.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── store/
│   ├── config.json
│   └── netlify.toml
├── scripts/
├── tests/
├── .gitignore
├── README.md
└── package.json
```

---

## 🔐 Конфигурация

### config.json (пример)
```json
{
  "networks": {
    "sepolia": {
      "rpcUrl": "https://sepolia.infura.io/v3/YOUR_KEY",
      "chainId": 11155111,
      "contracts": {
        "reputationToken": "0x...",
        "reputationHub": "0x...",
        "reputationDAO": "0x..."
      }
    }
  }
}
```

### Environment Variables
```env
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_CONTRACT_ADDRESS_HUB=
NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN=
NEXT_PUBLIC_CONTRACT_ADDRESS_DAO=
```

---

## ✅ Чеклист перед деплоем

- [ ] Все контракты протестированы
- [ ] Контракты задеплоены и верифицированы
- [ ] Frontend собирается без ошибок
- [ ] Все переменные окружения настроены
- [ ] Тестирование на тестовой сети
- [ ] README обновлен
- [ ] Документация API (если есть)
- [ ] Проверка безопасности
- [ ] Оптимизация производительности
- [ ] Mobile responsive проверен

---

## 🚀 Команды для деплоя

### Локальная разработка
```bash
# Установка зависимостей
npm install

# Запуск локальной ноды (Hardhat)
npx hardhat node

# Деплой контрактов
npx hardhat run scripts/deploy.js --network sepolia

# Запуск frontend
cd frontend
npm run dev
```

### Netlify деплой
```bash
# Build для проверки
npm run build

# Netlify CLI деплой
netlify deploy --prod
```

---

## 📝 Примечания

- Используй тестовую сеть для разработки (Sepolia, Base Sepolia)
- Все приватные ключи в .env (не коммитить!)
- Регулярно делай коммиты
- Документируй сложную логику
- Тестируй на разных кошельках

---

## 🎯 MVP Scope (для хакатона)

**Минимально жизнеспособный продукт:**
1. ✅ Расчет базовой репутации кошелька
2. ✅ Минт токенов репутации
3. ✅ Передача репутации с сообщением
4. ✅ Базовый фид активности
5. ✅ Простое DAO голосование

**Nice to have (если время):**
- Продвинутый алгоритм расчета репутации
- NFT репутации (ERC-721)
- Геймификация (бейджи, уровни)
- Социальные функции (подписки, комментарии)

---

**Удачи на хакатоне! 🚀**
