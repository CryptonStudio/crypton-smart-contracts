// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

interface IFarming {
    struct User {
        uint256 amount;
        uint256 depositTime;
        uint256 tokenId;
        uint256 unclaimed;
    }

    enum TimeErrorCodes {
        NOT_STARTED,
        FINISHED,
        WRONG_PERIOD
    }

    /// @notice Called by not owner wallet
    error OnlyOwnerAllowed();
    /// @notice Contract already initialized
    error InitializeError();
    /// @notice User have no stake to withdraw
    error NothingToWithdraw();
    /// @notice User have no reward to claim
    error NothingToClaim();
    /// @notice Contract have not enough reward tokens
    error InsufficientBalance();
    /// @notice User already have a stake
    error AlreadyStaked();
    /// @notice User have no stake to restake
    error NotStakedYet();
    /// @notice Stake exceeds amount of tokens left
    error TooManyTokens();
    /// @notice Wrong time for deposit or start time is greater than end time
    error FarmingTimeError(TimeErrorCodes errorCode);

    /// @notice Initializes farming
    /// @param totalAmount maximum amount of staked tokens
    /// @param rewardPercent reward percent per week
    /// @param farmintStart start time
    /// @param farmintEnd end time
    function initialize(
        uint256 totalAmount,
        uint256 rewardPercent,
        uint256 farmintStart,
        uint256 farmintEnd
    ) external;

    /// @notice Deposits tokens
    /// For deposit without boost use tokenId = 0
    /// @param amount amount to deposit
    /// @param tokenId boost token id
    function deposit(uint256 amount, uint256 tokenId) external;

    /// @notice Deposits additional tokens
    /// @param amount amount to deposit
    function restake(uint256 amount) external;

    /// @notice Claims rewards and withdraws stake tokens
    function claimAndWithdraw() external;

    /// @notice Claims rewards tokens without withdraw
    function claimRewards() external;

    /// @notice Adds reward tokens to contract
    /// Only callable by owner
    /// @param amount amount of reward token to add
    function addRewards(uint256 amount) external;

    /// @notice Returns claimable amount for given parameters
    /// @param rewardMultiplier multiplier from NFT
    /// @param depositTime time of deposit
    /// @param estimateEndTime estimated time of claim
    /// @param amount stake amount
    /// @param unclaimed amount of unclaimed reward tokens after restake
    /// @return reward amount of reward token available
    function calculateClaimableAmount(
        uint256 rewardMultiplier,
        uint256 depositTime,
        uint256 estimateEndTime,
        uint256 amount,
        uint256 unclaimed
    ) external view returns (uint256 reward);
}
