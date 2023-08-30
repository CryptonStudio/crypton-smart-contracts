//SPDX-License-Identifier: Unlicense
pragma solidity =0.8.17;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBoosToken} from "./interfaces/IBoosToken.sol";
import {IFarming} from "./interfaces/IFarming.sol";

contract Farming is IFarming {
    using SafeERC20 for IERC20Metadata;
    //100%
    uint256 public constant HUNDRED_PERCENT = 1000000;

    uint256 public constant EPOCH = 1 weeks;

    // owner
    address public immutable owner;

    //address of a staking token
    IERC20Metadata public immutable stakingToken;

    //address of a boosting NFT
    IBoosToken public immutable boostingToken;

    //address of a reward token
    IERC20Metadata public immutable rewardToken;

    //amount of tokens left that can be staked
    uint256 public tokensLeft;
    //reward percentage per week
    uint256 public percentage;
    //farming start time
    uint256 public startTime;
    //farming end time
    uint256 public endTime;
    //shows if farming was already initialized
    bool public initialized;

    //mapping for users
    mapping(address => User) public users;

    //mapping for NFT multipliers
    mapping(IBoosToken.Rarity => uint256) public boostMultiplier;

    event Initialized(
        uint256 tokensLeft,
        uint256 percentReward,
        uint256 startTime,
        uint256 endTime
    );
    event Deposited(address user, uint256 amount);
    event Withdrawn(address user);
    event Claimed(address user, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwnerAllowed();
        _;
    }

    constructor(
        address staking,
        address reward,
        address boosting,
        uint256[4] memory boosts
    ) {
        owner = msg.sender;
        stakingToken = IERC20Metadata(staking);
        rewardToken = IERC20Metadata(reward);
        boostingToken = IBoosToken(boosting);
        boostMultiplier[IBoosToken.Rarity.NULL] = boosts[0];
        boostMultiplier[IBoosToken.Rarity.COMMON] = boosts[1];
        boostMultiplier[IBoosToken.Rarity.UNCOMMON] = boosts[2];
        boostMultiplier[IBoosToken.Rarity.RARE] = boosts[3];
    }

    /// @inheritdoc IFarming
    function initialize(
        uint256 totalAmount,
        uint256 rewardPercent,
        uint256 farmingStart,
        uint256 farmingEnd
    ) external override onlyOwner {
        if (initialized) revert InitializeError();
        if (farmingEnd <= farmingStart) revert FarmingTimeError(TimeErrorCodes.WRONG_PERIOD);
        tokensLeft = totalAmount;
        percentage = rewardPercent;
        startTime = farmingStart;
        endTime = farmingEnd;
        initialized = true;
        emit Initialized(totalAmount, rewardPercent, farmingStart, farmingEnd);
    }

    /// @inheritdoc IFarming
    function addRewards(uint256 amount) external override onlyOwner {
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IFarming
    function deposit(uint256 amount, uint256 tokenId) external override {
        if (startTime > block.timestamp) revert FarmingTimeError(TimeErrorCodes.NOT_STARTED);
        if (endTime <= block.timestamp) revert FarmingTimeError(TimeErrorCodes.FINISHED);
        if (amount > tokensLeft) revert TooManyTokens();
        if (users[msg.sender].amount > 0) revert AlreadyStaked();

        //slither-disable-next-line reentrancy-no-eth
        if (tokenId != 0) boostingToken.lockToken(tokenId); // ERC-5192 token locking
        users[msg.sender] = User({
            amount: amount,
            depositTime: block.timestamp,
            tokenId: tokenId,
            unclaimed: 0
        });
        tokensLeft -= amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @inheritdoc IFarming
    function restake(uint256 amount) external override {
        if (endTime <= block.timestamp) revert FarmingTimeError(TimeErrorCodes.FINISHED);
        if (amount > tokensLeft) revert TooManyTokens();
        if (users[msg.sender].amount == 0) revert NotStakedYet();
        User storage user = users[msg.sender];
        uint256 rewardMultiplier = boostMultiplier[boostingToken.getRarity(user.tokenId)];
        uint256 claimable = calculateClaimableAmount(
            rewardMultiplier,
            user.depositTime,
            block.timestamp,
            user.amount,
            user.unclaimed
        );
        user.amount += amount;
        user.depositTime = block.timestamp;
        user.unclaimed += claimable;
        tokensLeft -= amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IFarming
    function claimAndWithdraw() external override {
        User storage user = users[msg.sender];
        if (user.amount == 0) revert NothingToWithdraw();
        uint256 rewardMultiplier = boostMultiplier[boostingToken.getRarity(user.tokenId)];
        uint256 claimable = calculateClaimableAmount(
            rewardMultiplier,
            user.depositTime,
            block.timestamp,
            user.amount,
            user.unclaimed
        );
        uint256 amount = user.amount;
        user.amount = 0;
        if (user.tokenId != 0) {
            //slither-disable-next-line reentrancy-no-eth
            boostingToken.unlockToken(user.tokenId); // ERC-5192 token unlocking
            user.tokenId = 0;
        }
        stakingToken.safeTransfer(msg.sender, amount);
        _claimRewards(claimable);
        emit Withdrawn(msg.sender);
    }

    /// @inheritdoc IFarming
    function claimRewards() external override {
        User memory user = users[msg.sender];
        uint256 rewardMultiplier = boostMultiplier[boostingToken.getRarity(user.tokenId)];
        uint256 claimable = calculateClaimableAmount(
            rewardMultiplier,
            user.depositTime,
            block.timestamp,
            user.amount,
            user.unclaimed
        );
        users[msg.sender].depositTime = block.timestamp;
        _claimRewards(claimable);
    }

    /// @inheritdoc IFarming
    function calculateClaimableAmount(
        uint256 rewardMultiplier,
        uint256 depositTime,
        uint256 estimateEndTime,
        uint256 amount,
        uint256 unclaimed
    ) public view override returns (uint256 reward) {
        uint256 elapsed;
        if (estimateEndTime > endTime) elapsed = endTime - depositTime;
        else elapsed = estimateEndTime - depositTime;
        return
            unclaimed +
            (amount * percentage * rewardMultiplier * elapsed) /
            EPOCH /
            HUNDRED_PERCENT /
            HUNDRED_PERCENT;
    }

    /// @notice Transfer reward tokens
    /// @param amount amount to transfer
    function _claimRewards(uint256 amount) internal {
        if (amount == 0) revert NothingToClaim();
        if (rewardToken.balanceOf(address(this)) < amount) revert InsufficientBalance();
        rewardToken.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
