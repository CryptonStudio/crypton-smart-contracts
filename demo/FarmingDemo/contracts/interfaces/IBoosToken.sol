// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

interface IBoosToken {
    enum Rarity {
        NULL, // Used for simplify farming without boost
        COMMON,
        UNCOMMON,
        RARE
    }

    struct RequestStatus {
        bool fulfilled; // whether the request has been successfully fulfilled
        bool exists; // whether a requestId exists
        address recipient; // NFT recipient
        uint256[] randomWords; // Random number
    }

    ///@notice Trying to operate with locked token
    error TokenIsLocked();
    ///@notice Request with given id isn't exists
    error WrongRequestId();
    ///@notice Caller is not approved for token
    error NotApprovedOrOwner();

    /// @notice Creates mint request to VRF coordinator
    /// should be executed after 3 block confirmations
    /// @param to address of token recipient
    function safeMint(address to) external;

    /// @notice Locks token transfers
    /// Only callable by STAKING_ROLE
    /// @param tokenId id of token to lock
    function lockToken(uint256 tokenId) external;

    /// @notice Unlocks token transfers
    /// Only callable by STAKING_ROLE
    /// @param tokenId id of token to unlock
    function unlockToken(uint256 tokenId) external;

    /// @notice Returns lock status
    /// @param tokenId id of token
    function getLockStatus(uint256 tokenId) external view returns (bool);

    /// @notice Returns token rarity
    /// @param tokenId id of token
    function getRarity(uint256 tokenId) external view returns (Rarity);

    /// @notice Returns status of request to VRF coordinator
    /// @param requestId id of request
    /// @return fulfilled is request fulfilled
    /// @return randomWords received random words(empty if not fulfilled yet)
    function getRequestStatus(uint256 requestId)
        external
        view
        returns (bool fulfilled, uint256[] memory randomWords);
}
