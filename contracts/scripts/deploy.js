const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  
  if (!deployer) {
    throw new Error("No deployer account found. Please check your PRIVATE_KEY in .env file.");
  }
  
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await hre.ethers.provider.getBalance(deployer.address)).toString());

  // Деплой ReputationToken
  console.log("\n1. Deploying ReputationToken...");
  const ReputationToken = await hre.ethers.getContractFactory("ReputationToken");
  const reputationToken = await ReputationToken.deploy();
  await reputationToken.waitForDeployment();
  const tokenAddress = await reputationToken.getAddress();
  console.log("ReputationToken deployed to:", tokenAddress);

  // Деплой ReputationHub
  console.log("\n2. Deploying ReputationHub...");
  const ReputationHub = await hre.ethers.getContractFactory("ReputationHub");
  const reputationHub = await ReputationHub.deploy(tokenAddress);
  await reputationHub.waitForDeployment();
  const hubAddress = await reputationHub.getAddress();
  console.log("ReputationHub deployed to:", hubAddress);

  // Настройка прав для Hub контракта
  console.log("\n3. Setting up permissions...");
  const setHubTx = await reputationToken.setHub(hubAddress);
  await setHubTx.wait();
  console.log("Hub contract granted minter and burner roles");

  // Деплой ReputationDAO
  console.log("\n4. Deploying ReputationDAO...");
  const ReputationDAO = await hre.ethers.getContractFactory("ReputationDAO");
  const reputationDAO = await ReputationDAO.deploy(tokenAddress, hubAddress);
  await reputationDAO.waitForDeployment();
  const daoAddress = await reputationDAO.getAddress();
  console.log("ReputationDAO deployed to:", daoAddress);

  // Сохранение адресов в config
  const network = await hre.ethers.provider.getNetwork();
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  
  const configPath = path.join(__dirname, "../../config.json");
  let config = {};
  
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }
  
  if (!config.networks) {
    config.networks = {};
  }
  
  if (!config.networks[networkName]) {
    config.networks[networkName] = {
      rpcUrl: "",
      chainId: Number(network.chainId),
      explorerUrl: "",
      contracts: {}
    };
  }
  
  config.networks[networkName].contracts.reputationToken = tokenAddress;
  config.networks[networkName].contracts.reputationHub = hubAddress;
  config.networks[networkName].contracts.reputationDAO = daoAddress;
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("\n✅ Contract addresses saved to config.json");

  console.log("\n📋 Deployment Summary:");
  console.log("Network:", networkName);
  console.log("Chain ID:", network.chainId);
  console.log("ReputationToken:", tokenAddress);
  console.log("ReputationHub:", hubAddress);
  console.log("ReputationDAO:", daoAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
