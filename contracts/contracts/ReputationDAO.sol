// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReputationToken.sol";
import "./ReputationHub.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationDAO
 * @dev DAO контракт для голосования с использованием репутации
 */
contract ReputationDAO is Ownable {
    ReputationToken public reputationToken;
    ReputationHub public reputationHub;

    // Минимальная репутация для создания предложения
    uint256 public constant MIN_REPUTATION_TO_PROPOSE = 10 * 10**18; // 10 REP в wei
    
    // Максимальное количество предложений на кошелек в месяц
    uint256 public constant MAX_PROPOSALS_PER_MONTH = 2;
    
    // Время месяца в секундах (30 дней)
    uint256 public constant MONTH_IN_SECONDS = 30 * 24 * 60 * 60;

    // Структура предложения
    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 deadline;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        uint256 createdAt;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votesByAddress;
    }

    // Маппинг предложений
    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    
    // Трекинг создания предложений для каждого адреса
    mapping(address => uint256[]) public proposerProposals; // Список ID предложений по адресу

    // События
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 deadline
    );
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 reputationAmount
    );
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(address _reputationToken, address _reputationHub) Ownable(msg.sender) {
        reputationToken = ReputationToken(_reputationToken);
        reputationHub = ReputationHub(_reputationHub);
    }
    
    /**
     * @dev Установка адреса ReputationHub (если нужно изменить)
     */
    function setReputationHub(address _reputationHub) external onlyOwner {
        reputationHub = ReputationHub(_reputationHub);
    }

    /**
     * @dev Создание нового предложения
     * @param description Описание предложения
     * @param deadline Дедлайн для голосования (timestamp)
     */
    function createProposal(string memory description, uint256 deadline)
        external
        returns (uint256)
    {
        require(deadline > block.timestamp, "Deadline must be in the future");
        require(bytes(description).length > 0, "Description cannot be empty");
        require(bytes(description).length <= 500, "Description too long");
        
        // Проверка минимальной репутации
        uint256 reputationScore = reputationHub.getReputationScore(msg.sender);
        require(
            reputationScore >= MIN_REPUTATION_TO_PROPOSE,
            "Insufficient reputation to create proposal"
        );
        
        // Проверка лимита предложений в месяц
        require(
            canCreateProposal(msg.sender),
            "Monthly proposal limit reached"
        );

        proposalCount++;
        uint256 proposalId = proposalCount;

        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.description = description;
        proposal.deadline = deadline;
        proposal.executed = false;
        proposal.createdAt = block.timestamp;
        
        // Добавляем предложение в список создателя
        proposerProposals[msg.sender].push(proposalId);

        emit ProposalCreated(proposalId, msg.sender, description, deadline);
        return proposalId;
    }
    
    /**
     * @dev Проверка, может ли пользователь создать предложение
     * @param proposer Адрес предлагающего
     * @return true если может создать, false если нет
     */
    function canCreateProposal(address proposer) public view returns (bool) {
        uint256[] memory proposalsIds = proposerProposals[proposer];
        uint256 currentTime = block.timestamp;
        uint256 oneMonthAgo = currentTime - MONTH_IN_SECONDS;
        
        // Считаем количество предложений за последний месяц
        uint256 proposalsInLastMonth = 0;
        for (uint256 i = 0; i < proposalsIds.length; i++) {
            if (proposals[proposalsIds[i]].createdAt >= oneMonthAgo) {
                proposalsInLastMonth++;
            }
        }
        
        return proposalsInLastMonth < MAX_PROPOSALS_PER_MONTH;
    }
    
    /**
     * @dev Получение количества предложений пользователя за последний месяц
     * @param proposer Адрес предлагающего
     * @return Количество предложений за последний месяц
     */
    function getProposalsInLastMonth(address proposer) external view returns (uint256) {
        uint256[] memory proposalsIds = proposerProposals[proposer];
        uint256 currentTime = block.timestamp;
        uint256 oneMonthAgo = currentTime - MONTH_IN_SECONDS;
        
        uint256 count = 0;
        for (uint256 i = 0; i < proposalsIds.length; i++) {
            if (proposals[proposalsIds[i]].createdAt >= oneMonthAgo) {
                count++;
            }
        }
        
        return count;
    }

    /**
     * @dev Голосование по предложению
     * @param proposalId ID предложения
     * @param support Поддержка (true) или против (false)
     * @param reputationAmount Количество репутации для голоса
     */
    function vote(
        uint256 proposalId,
        bool support,
        uint256 reputationAmount
    ) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");
        require(block.timestamp <= proposal.deadline, "Voting deadline passed");
        require(!proposal.executed, "Proposal already executed");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(
            reputationToken.balanceOf(msg.sender) >= reputationAmount,
            "Insufficient reputation"
        );

        // Отмечаем, что пользователь проголосовал
        proposal.hasVoted[msg.sender] = true;
        proposal.votesByAddress[msg.sender] = reputationAmount;

        // Учитываем голос
        if (support) {
            proposal.votesFor += reputationAmount;
        } else {
            proposal.votesAgainst += reputationAmount;
        }

        emit VoteCast(proposalId, msg.sender, support, reputationAmount);
    }

    /**
     * @dev Получение информации о предложении
     * @param proposalId ID предложения
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            uint256 id,
            address proposer,
            string memory description,
            uint256 deadline,
            uint256 votesFor,
            uint256 votesAgainst,
            bool executed,
            uint256 createdAt
        )
    {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "Proposal does not exist");

        return (
            proposal.id,
            proposal.proposer,
            proposal.description,
            proposal.deadline,
            proposal.votesFor,
            proposal.votesAgainst,
            proposal.executed,
            proposal.createdAt
        );
    }

    /**
     * @dev Проверка, проголосовал ли пользователь
     * @param proposalId ID предложения
     * @param voter Адрес голосующего
     */
    function hasVoted(uint256 proposalId, address voter)
        external
        view
        returns (bool)
    {
        return proposals[proposalId].hasVoted[voter];
    }

    /**
     * @dev Получение количества голосов пользователя
     * @param proposalId ID предложения
     * @param voter Адрес голосующего
     */
    function getVoteAmount(uint256 proposalId, address voter)
        external
        view
        returns (uint256)
    {
        return proposals[proposalId].votesByAddress[voter];
    }
}
