const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function main() {
  const daoAddress = "0x950977950Ffa0B6ca1d5Cc1d5be56450F5323a83";
  
  console.log("Checking DAO contract at:", daoAddress);
  
  const ReputationDAO = await hre.ethers.getContractFactory("ReputationDAO");
  const dao = ReputationDAO.attach(daoAddress);
  
  // Получаем адрес Hub контракта из DAO
  const hubAddress = await dao.reputationHub();
  console.log("\nCurrent Hub address in DAO:", hubAddress);
  
  // Получаем адрес Token контракта из DAO
  const tokenAddress = await dao.reputationToken();
  console.log("Current Token address in DAO:", tokenAddress);
  
  // Проверяем адреса из конфига
  const configPath = path.join(__dirname, "../../config.json");
  const config = require(configPath);
  const configHub = config.networks?.neura_testnet?.contracts?.reputationHub;
  const configToken = config.networks?.neura_testnet?.contracts?.reputationToken;
  
  console.log("\nHub address in config.json:", configHub || "not found");
  console.log("Token address in config.json:", configToken || "not found");
  
  if (hubAddress.toLowerCase() !== configHub?.toLowerCase()) {
    console.log("\n⚠️  WARNING: Hub address mismatch!");
    console.log("DAO is using:", hubAddress);
    console.log("Config has:", configHub);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
