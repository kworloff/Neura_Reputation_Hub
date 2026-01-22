# 🏆 Neura Reputation Hub — EVM Hackathon Project

A decentralized platform for evaluating and managing wallet reputation on EVM networks.

## 📋 Overview

**Neura Reputation Hub** lets you:

- 📊 **Evaluate** wallet reputation from on-chain activity
- 🪙 **Earn** reputation tokens (ERC‑20)
- 💬 **Transfer** reputation to others with messages
- 📰 **Browse** a feed of all reputation transfers
- 🗳️ **Vote** in the DAO using your reputation

## 🛠 Tech Stack

- **Smart contracts**: Solidity ^0.8.20, Hardhat, OpenZeppelin
- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, ethers.js v6
- **Deploy**: Netlify (frontend), Neura Testnet (contracts)

## 🚀 Quick Start

### Install dependencies

```bash
npm install
cd contracts && npm install
cd ../frontend && npm install
```

### Configuration

1. Copy `config.example.json` to `config.json`.
2. Create `.env` in the project root (for contract deploy): `PRIVATE_KEY`, `NEURA_RPC_URL`.
3. In `frontend/`, create `.env.local` (see `frontend/.env.example`):

   ```
   NEXT_PUBLIC_RPC_URL=https://rpc.ankr.com/neura_testnet
   NEXT_PUBLIC_CHAIN_ID=267
   NEXT_PUBLIC_CHAIN_NAME=Neura Testnet
   NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN=0x...
   NEXT_PUBLIC_CONTRACT_ADDRESS_HUB=0x...
   NEXT_PUBLIC_CONTRACT_ADDRESS_DAO=0x...
   ```

   Fill contract addresses from `config.json` after deploying.

### Deploy contracts (Neura Testnet)

```bash
cd contracts
npx hardhat run scripts/deploy.js --network neura_testnet
```

Then update addresses in `frontend/.env.local`.

### Run frontend

```bash
cd frontend
npm run dev
```

## 🌐 Deploy on Netlify

1. Push the repo to a **public** GitHub/GitLab repository.
2. In [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project** → select the repo.
3. Build settings:
   - **Base directory:** `frontend`
   - **Build command:** `npm run build`
   - **Publish directory:** leave default (uses `frontend/netlify.toml` and Next.js plugin).
4. **Environment variables** (Site settings → Environment variables):
   - `NEXT_PUBLIC_RPC_URL` = `https://rpc.ankr.com/neura_testnet`
   - `NEXT_PUBLIC_CHAIN_ID` = `267`
   - `NEXT_PUBLIC_CHAIN_NAME` = `Neura Testnet`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN` = from `config.json`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_HUB` = from `config.json`
   - `NEXT_PUBLIC_CONTRACT_ADDRESS_DAO` = from `config.json`
5. Trigger **Deploy**.

## 📁 Project structure

```
├── contracts/          # Solidity contracts, deploy scripts, tests
├── frontend/           # Next.js app (deploy to Netlify)
├── config.example.json
├── README.md
└── ...
```

## 📝 Docs

- [road.md](./road.md) — development roadmap
- [REPUTATION_CRITERIA.md](./REPUTATION_CRITERIA.md) — reputation scoring
- [PROJECT_DESCRIPTION.md](./PROJECT_DESCRIPTION.md) — project summary
- [SECURITY_AUDIT.md](./SECURITY_AUDIT.md) — security notes

## 🔐 Security

⚠️ **Do not commit private keys or secrets to Git.**

## 📄 License

MIT
