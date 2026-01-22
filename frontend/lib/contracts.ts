import { ethers } from 'ethers';
import { getProvider } from './web3';

// ABI контрактов (будут заменены на реальные после деплоя)
export const REPUTATION_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export const REPUTATION_HUB_ABI = [
  'function calculateReputation(address wallet) view returns (uint256)',
  'function mintReputation(address wallet, uint256 amount)',
  'function autoMintReputation(uint256 amount)',
  'function getReputationScore(address wallet) view returns (uint256)',
  'function transferReputation(address to, uint256 amount, string memory message)',
  'function getFeed(uint256 limit, uint256 offset) view returns (tuple(address from, address to, uint256 amount, string message, uint256 timestamp, uint256 blockNumber)[])',
  'function getTransferCount() view returns (uint256)',
  'function owner() view returns (address)',
  'function hasMinted(address wallet) view returns (bool)',
  'function MAX_MINTABLE_REPUTATION() view returns (uint256)',
  'event ReputationMinted(address indexed wallet, uint256 amount)',
  'event ReputationTransferred(address indexed from, address indexed to, uint256 amount, string message, uint256 timestamp)',
];

export const REPUTATION_DAO_ABI = [
  'function createProposal(string memory description, uint256 deadline) returns (uint256)',
  'function vote(uint256 proposalId, bool support, uint256 reputationAmount)',
  'function getProposal(uint256 proposalId) view returns (uint256 id, address proposer, string memory description, uint256 deadline, uint256 votesFor, uint256 votesAgainst, bool executed, uint256 createdAt)',
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  'function getVoteAmount(uint256 proposalId, address voter) view returns (uint256)',
  'function canCreateProposal(address proposer) view returns (bool)',
  'function getProposalsInLastMonth(address proposer) view returns (uint256)',
  'function proposalCount() view returns (uint256)',
  'function MIN_REPUTATION_TO_PROPOSE() view returns (uint256)',
  'function MAX_PROPOSALS_PER_MONTH() view returns (uint256)',
  'event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 deadline)',
  'event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 reputationAmount)',
];

/**
 * Получение контракта ReputationToken
 */
export function getReputationTokenContract(address: string, signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(address, REPUTATION_TOKEN_ABI, provider);
}

/**
 * Получение контракта ReputationHub
 */
export function getReputationHubContract(address: string, signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(address, REPUTATION_HUB_ABI, provider);
}

/**
 * Получение контракта ReputationDAO
 */
export function getReputationDAOContract(address: string, signer?: ethers.Signer) {
  const provider = signer || getProvider();
  return new ethers.Contract(address, REPUTATION_DAO_ABI, provider);
}
