const hre = require("hardhat");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

async function main() {
  const daoAddress = "0x950977950Ffa0B6ca1d5Cc1d5be56450F5323a83";
  const newHubAddress = "0xBA637A9D3183660ffaBf0d1A7A9a9Da3e20d533D"; // Новый адрес Hub из .env.local
  
  console.log("Updating DAO Hub address...");
  console.log("DAO address:", daoAddress);
  console.log("New Hub address:", newHubAddress);
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Updating with account:", deployer.address);
  
  const ReputationDAO = await hre.ethers.getContractFactory("ReputationDAO");
  const dao = ReputationDAO.attach(daoAddress);
  
  // Проверяем текущий адрес
  const currentHubAddress = await dao.reputationHub();
  console.log("\nCurrent Hub address:", currentHubAddress);
  
  if (currentHubAddress.toLowerCase() === newHubAddress.toLowerCase()) {
    console.log("✅ Hub address is already correct!");
    return;
  }
  
  // Обновляем адрес Hub
  console.log("\nUpdating Hub address...");
  const tx = await dao.setReputationHub(newHubAddress);
  console.log("Transaction hash:", tx.hash);
  
  await tx.wait();
  console.log("✅ Hub address updated successfully!");
  
  // Проверяем новый адрес
  const updatedHubAddress = await dao.reputationHub();
  console.log("New Hub address in DAO:", updatedHubAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
