// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ReputationToken.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReputationHub
 * @dev Основной контракт для управления репутацией
 */
contract ReputationHub is Ownable {
    ReputationToken public reputationToken;

    // Структура для хранения передачи репутации
    struct ReputationTransfer {
        address from;
        address to;
        uint256 amount;
        string message;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // Маппинг репутации кошельков
    mapping(address => uint256) public reputationScores;
    
    // Маппинг для отслеживания, минтил ли пользователь уже репутацию
    mapping(address => bool) public hasMinted;
    
    // Максимальная репутация, которую можно заминтить (500 REP)
    uint256 public constant MAX_MINTABLE_REPUTATION = 500 * 10**18;
    
    // История передач
    ReputationTransfer[] public transfers;
    
    // События
    event ReputationCalculated(address indexed wallet, uint256 score);
    event ReputationMinted(address indexed wallet, uint256 amount);
    event ReputationTransferred(
        address indexed from,
        address indexed to,
        uint256 amount,
        string message,
        uint256 timestamp
    );

    constructor(address _reputationToken) Ownable(msg.sender) {
        reputationToken = ReputationToken(_reputationToken);
    }

    /**
     * @dev Расчет репутации кошелька (заглушка, будет расширена)
     * @param wallet Адрес кошелька
     * @return score Репутационный счет
     */
    function calculateReputation(address wallet) public view returns (uint256 score) {
        // Базовая логика: можно расширить с помощью оракулов
        // Пока возвращаем текущий счет или 0
        return reputationScores[wallet];
    }

    /**
     * @dev Выдача репутации кошельку (только для owner)
     * @param wallet Адрес кошелька
     * @param amount Количество репутации для выдачи
     */
    function mintReputation(address wallet, uint256 amount) external onlyOwner {
        reputationScores[wallet] += amount;
        reputationToken.mint(wallet, amount);
        emit ReputationMinted(wallet, amount);
    }

    /**
     * @dev Автоматический минт репутации пользователем на основе расчета
     * @param amount Количество репутации для минтинга (должно быть рассчитано на фронтенде)
     */
    function autoMintReputation(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= MAX_MINTABLE_REPUTATION, "Amount exceeds maximum mintable reputation");
        
        address wallet = msg.sender;
        
        // Если пользователь уже минтил, разрешаем обновление только если новое значение больше
        if (hasMinted[wallet]) {
            require(amount > reputationScores[wallet], "New amount must be greater than current score");
            // Обновляем счет (вычитаем старое значение и добавляем новое)
            uint256 difference = amount - reputationScores[wallet];
            reputationScores[wallet] = amount;
            reputationToken.mint(wallet, difference);
            emit ReputationMinted(wallet, difference);
        } else {
            // Первый минт
            reputationScores[wallet] = amount;
            reputationToken.mint(wallet, amount);
            hasMinted[wallet] = true;
            emit ReputationMinted(wallet, amount);
        }
    }

    /**
     * @dev Передача репутации с сообщением
     * @param to Адрес получателя
     * @param amount Количество репутации
     * @param message Сообщение для получателя
     */
    function transferReputation(
        address to,
        uint256 amount,
        string memory message
    ) external {
        require(to != address(0), "Invalid recipient");
        require(msg.sender != to, "Cannot transfer to self");
        require(amount > 0, "Amount must be greater than 0");
        require(
            reputationToken.balanceOf(msg.sender) >= amount,
            "Insufficient reputation"
        );
        require(
            reputationToken.allowance(msg.sender, address(this)) >= amount,
            "Insufficient allowance"
        );
        require(bytes(message).length <= 500, "Message too long");
        require(
            reputationScores[msg.sender] >= amount,
            "Insufficient reputation score"
        );

        // Обновляем счета (Effects перед Interactions для защиты от reentrancy)
        reputationScores[msg.sender] -= amount;
        reputationScores[to] += amount;

        // Сохраняем передачу
        transfers.push(
            ReputationTransfer({
                from: msg.sender,
                to: to,
                amount: amount,
                message: message,
                timestamp: block.timestamp,
                blockNumber: block.number
            })
        );

        // Переводим токены (Interactions в конце)
        reputationToken.transferFrom(msg.sender, to, amount);

        emit ReputationTransferred(msg.sender, to, amount, message, block.timestamp);
    }

    /**
     * @dev Получение репутационного счета
     * @param wallet Адрес кошелька
     * @return score Текущий счет репутации
     */
    function getReputationScore(address wallet) external view returns (uint256) {
        return reputationScores[wallet];
    }

    /**
     * @dev Получение фида передач
     * @param limit Количество записей
     * @param offset Смещение
     * @return result Массив передач
     */
    function getFeed(uint256 limit, uint256 offset)
        external
        view
        returns (ReputationTransfer[] memory result)
    {
        uint256 total = transfers.length;
        if (offset >= total) {
            return new ReputationTransfer[](0);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        uint256 count = end - offset;
        result = new ReputationTransfer[](count);

        // Заполняем в обратном порядке (новые первыми)
        for (uint256 i = 0; i < count; i++) {
            result[i] = transfers[total - 1 - offset - i];
        }

        return result;
    }

    /**
     * @dev Получение общего количества передач
     */
    function getTransferCount() external view returns (uint256) {
        return transfers.length;
    }
}
