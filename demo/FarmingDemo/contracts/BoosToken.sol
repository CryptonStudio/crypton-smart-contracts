// SPDX-License-Identifier: MIT
pragma solidity =0.8.17;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {VRFConsumerBaseV2} from "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import {VRFCoordinatorV2Interface} from "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import {Counters} from "@openzeppelin/contracts/utils/Counters.sol";
import {IBoosToken} from "./interfaces/IBoosToken.sol";

contract BoosToken is ERC721, AccessControl, IBoosToken, VRFConsumerBaseV2, ConfirmedOwner {
    using Counters for Counters.Counter;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");

    Counters.Counter private _tokenIds;

    // VRF Coordinator address
    VRFCoordinatorV2Interface private immutable _coordinator;
    // Subscription id on chainlink
    uint64 private immutable _subscriptionId;
    // Gas limit for fulfillRandomWords
    uint32 private immutable _callbackGasLimit = 150000;
    // Confirmations before execute fulfillRandomWords
    uint16 private immutable _requestConfirmations = 3;
    // Number of random words from coordinator
    uint32 private immutable _numWords = 1;

    // Keyhash for gasprice
    bytes32 private immutable _keyHash;

    // Past requests Id.
    uint256[] public requestIds;
    // Last request id
    uint256 public lastRequestId;

    // Cumulative chances for rarity
    uint256[3] public chanceArray;

    //requestId --> requestStatus
    mapping(uint256 => RequestStatus) public requests;

    // Token lock status
    mapping(uint256 => bool) private _lockStatus;

    // Token rarity
    mapping(uint256 => Rarity) private _tokenRarityMap;

    event Locked(uint256 tokenId); // ERC-5192
    event Unlocked(uint256 tokenId); // ERC-5192
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords);

    modifier notLocked(uint256 tokenId) {
        if (_lockStatus[tokenId]) revert TokenIsLocked();
        _;
    }

    constructor(
        address coordinatorVRF,
        uint64 subscriptionId,
        bytes32 key,
        uint256[3] memory chances
    ) ERC721("BoosToken", "BT") VRFConsumerBaseV2(coordinatorVRF) ConfirmedOwner(_msgSender()) {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, _msgSender());
        _coordinator = VRFCoordinatorV2Interface(coordinatorVRF);
        _subscriptionId = subscriptionId;
        _keyHash = key;
        chanceArray = chances;
    }

    /// @inheritdoc IBoosToken
    function safeMint(address to) external override onlyRole(MINTER_ROLE) {
        _requestRandomWords(to);
    }

    /// @inheritdoc IBoosToken
    function lockToken(uint256 tokenId)
        external
        override
        notLocked(tokenId)
        onlyRole(STAKING_ROLE)
    {
        if (!_isApprovedOrOwner(_msgSender(), tokenId)) revert NotApprovedOrOwner();
        _lockStatus[tokenId] = true;
        emit Locked(tokenId);
    }

    /// @inheritdoc IBoosToken
    function unlockToken(uint256 tokenId) external override onlyRole(STAKING_ROLE) {
        _lockStatus[tokenId] = false;
        emit Unlocked(tokenId);
    }

    /// @inheritdoc IBoosToken
    function getRequestStatus(uint256 requestId)
        external
        view
        override
        returns (bool fulfilled, uint256[] memory randomWords)
    {
        if (!requests[requestId].exists) revert WrongRequestId();
        RequestStatus memory request = requests[requestId];
        return (request.fulfilled, request.randomWords);
    }

    /// @inheritdoc IBoosToken
    function getLockStatus(uint256 tokenId) external view override returns (bool) {
        return _lockStatus[tokenId];
    }

    /// @inheritdoc IBoosToken
    function getRarity(uint256 tokenId) external view override returns (Rarity) {
        return _tokenRarityMap[tokenId];
    }
    
    /// @notice See {IERC165-supportsInterface}.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /// @notice Used by VRFCoordinator, execute mint request
    /// @param requestId id of mint request
    /// @param randomWords array of random words
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        if (!requests[requestId].exists) revert WrongRequestId();
        _tokenIds.increment();
        uint256 randomNumber = randomWords[0] % 100; // Number should be in range 0-99
        Rarity rarity = _gambleRarity(randomNumber);
        _tokenRarityMap[_tokenIds.current()] = rarity;
        requests[requestId].fulfilled = true;
        _safeMint(requests[requestId].recipient, _tokenIds.current());
        emit RequestFulfilled(requestId, randomWords);
    }

    /// @notice Request to VRFCoordinator for random words
    /// @param to address of NFT recipient
    /// @return requestId id of request
    function _requestRandomWords(address to) internal returns (uint256 requestId) {
        // Will revert if subscription is not set and funded.
        requestId = _coordinator.requestRandomWords(
            _keyHash,
            _subscriptionId,
            _requestConfirmations,
            _callbackGasLimit,
            _numWords
        );
        requests[requestId] = RequestStatus({
            randomWords: new uint256[](0),
            exists: true,
            fulfilled: false,
            recipient: to
        });
        requestIds.push(requestId);
        lastRequestId = requestId;
        emit RequestSent(requestId, _numWords);
        return requestId;
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override notLocked(tokenId) {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /// @notice Returns rarity of NFT by given number
    /// @param randomNumber number in range 0-99
    /// @param rarity resulting rarity
    function _gambleRarity(uint256 randomNumber) internal view returns (Rarity rarity) {
        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (randomNumber <= chanceArray[i]) return Rarity(i + 1);
        }
    }
}
