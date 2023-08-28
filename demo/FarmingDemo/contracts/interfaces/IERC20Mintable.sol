// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

interface IERC20Mintable {
    /// @notice Mints tokens
    /// Only callable by MINTER_ROLE
    /// @param to address of tokenы recipient
    /// @param amount amount to mint
    function mint(address to, uint256 amount) external;
}
