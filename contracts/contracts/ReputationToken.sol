// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ReputationToken
 * @dev ERC-20 токен репутации, который может минтиться только Hub контрактом
 */
contract ReputationToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() ERC20("Reputation Token", "REP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Минт токенов репутации (только для Hub контракта)
     * @param to Адрес получателя
     * @param amount Количество токенов для минтинга
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /**
     * @dev Сжигание токенов репутации
     * @param from Адрес отправителя
     * @param amount Количество токенов для сжигания
     */
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }

    /**
     * @dev Назначение Hub контракта как минтера
     * @param hub Адрес Hub контракта
     */
    function setHub(address hub) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MINTER_ROLE, hub);
        _grantRole(BURNER_ROLE, hub);
    }
}
