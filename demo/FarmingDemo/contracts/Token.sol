// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20Mintable} from "./interfaces/IERC20Mintable.sol";

contract Token is ERC20, AccessControl, IERC20Mintable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(
        string memory name,
        string memory symbol,
        uint256 initSupply
    ) ERC20(name, symbol) {
        _mint(_msgSender(), initSupply);
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, _msgSender());
    }

    function mint(address to, uint256 amount) external override onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
