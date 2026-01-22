/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_CONTRACT_ADDRESS_HUB: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_HUB,
    NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TOKEN,
    NEXT_PUBLIC_CONTRACT_ADDRESS_DAO: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_DAO,
  },
};

module.exports = nextConfig;
