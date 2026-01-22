const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReputationToken", function () {
  let reputationToken;
  let owner;
  let addr1;
  let addr2;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const ReputationToken = await ethers.getContractFactory("ReputationToken");
    reputationToken = await ReputationToken.deploy();
    await reputationToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await reputationToken.name()).to.equal("Reputation Token");
      expect(await reputationToken.symbol()).to.equal("REP");
    });
  });

  // Добавьте больше тестов здесь
});
