import { expect } from 'chai'
import { loadFixture, time, mineUpTo } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { BoosToken, Farming, Token, VRFCoordinatorV2Mock } from '../typechain'
import { BoosToken__factory, Token__factory, VRFCoordinatorV2Mock__factory } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

// variables
let coordinator: VRFCoordinatorV2Mock
let stakingToken: Token
let rewardToken: Token
let boost: BoosToken
let farming: Farming
let owner: SignerWithAddress
let accounts: SignerWithAddress[]

// constants
const totalAmount = ethers.utils.parseEther('1000')
const percentage = 10000
const hundredPercent = 1000000
const week = 3600 * 24 * 7
const farmingTime = 3600 * 24 * 365
const amountOfEpochs = 3
const boostMultipliers = [1000000, 1200000, 1500000, 2000000]
const stake = ethers.utils.parseEther('100')

describe('Farming', function () {
  async function deployFixture() {
    [owner, ...accounts] = await ethers.getSigners()
    const Token = (await ethers.getContractFactory('Token')) as Token__factory
    const BoosToken = (await ethers.getContractFactory('BoosToken')) as BoosToken__factory
    const Farming = await ethers.getContractFactory('Farming')
    const Coordinator = (await ethers.getContractFactory('VRFCoordinatorV2Mock')) as VRFCoordinatorV2Mock__factory

    coordinator = (await Coordinator.deploy('100000000000000000', '1000000000')) as VRFCoordinatorV2Mock
    stakingToken = (await Token.deploy('Stake Token', 'ST', ethers.utils.parseEther('1000000'))) as Token
    rewardToken = (await Token.deploy('Reward Token', 'RT', ethers.utils.parseEther('1000000'))) as Token
    boost = (await BoosToken.deploy(
      coordinator.address,
      1,
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
      [60, 90, 100],
    )) as BoosToken
    farming = (await Farming.deploy(
      stakingToken.address,
      rewardToken.address,
      boost.address,
      boostMultipliers,
    )) as Farming
    await farming.deployed()

    for (let i = 0; i < 10; i++) {
      await stakingToken.mint(accounts[0].address, ethers.utils.parseEther('100'))
    }
  }

  async function deployInitFixture() {
    const reward = totalAmount.mul(percentage).mul(50).div(hundredPercent)

    const Token = (await ethers.getContractFactory('Token')) as Token__factory
    const BoosToken = (await ethers.getContractFactory('BoosToken')) as BoosToken__factory
    const Farming = await ethers.getContractFactory('Farming')
    const Coordinator = (await ethers.getContractFactory('VRFCoordinatorV2Mock')) as VRFCoordinatorV2Mock__factory

    coordinator = (await Coordinator.deploy('100000000000000000', '1000000000')) as VRFCoordinatorV2Mock
    stakingToken = (await Token.deploy('Stake Token', 'ST', ethers.utils.parseEther('1000000'))) as Token
    rewardToken = (await Token.deploy('Reward Token', 'RT', ethers.utils.parseEther('1000000'))) as Token
    boost = (await BoosToken.deploy(
      coordinator.address,
      1,
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
      [60, 90, 100],
    )) as BoosToken
    farming = (await Farming.deploy(
      stakingToken.address,
      rewardToken.address,
      boost.address,
      boostMultipliers,
    )) as Farming
    await farming.deployed()

    await coordinator.connect(owner).createSubscription()
    await coordinator.connect(owner).addConsumer(1, boost.address)
    await coordinator.connect(owner).fundSubscription(1, ethers.utils.parseEther('100'))

    await rewardToken.connect(owner).approve(farming.address, reward)
    const startTime = (await time.latest()) + 100
    await farming.connect(owner).initialize(totalAmount, percentage, startTime, startTime + farmingTime)
    await farming.connect(owner).addRewards(reward)

    for (let i = 0; i < 10; i++) {
      await stakingToken.connect(owner).mint(accounts[i].address, stake)
    }

    await stakingToken.connect(owner).mint(accounts[1].address, stake)
    await boost.connect(owner).grantRole(await boost.STAKING_ROLE(), farming.address)
    await boost.connect(owner).safeMint(accounts[0].address)
    mineUpTo((await ethers.provider.getBlockNumber()) + 3)

    await coordinator.connect(owner).fulfillRandomWords(1, boost.address)
  }

  describe('Initialize', () => {
    it('Should be only callable by owner', async () => {
      await loadFixture(deployFixture)
      const startTime = (await time.latest()) + 100
      await rewardToken
        .connect(accounts[0])
        .approve(farming.address, totalAmount.mul(percentage).mul(amountOfEpochs).div(hundredPercent))
      await expect(
        farming.connect(accounts[0]).initialize(totalAmount, percentage, startTime, startTime + farmingTime),
      ).to.be.revertedWith('OnlyOwnerAllowed')
    })

    it('Should be unable to initialize with wrong time period', async () => {
      await loadFixture(deployFixture)
      await expect(farming.connect(owner).initialize(totalAmount, percentage, 100, 0)).to.be.revertedWith(
        'FarmingTimeError(2)',
      )
    })

    it('Should be initialized correctly', async () => {
      await loadFixture(deployFixture)
      const startTime = (await time.latest()) + 100
      await rewardToken.approve(farming.address, totalAmount.mul(percentage).mul(amountOfEpochs).div(hundredPercent))
      await farming.initialize(totalAmount, percentage, startTime, startTime + 3600 * 24 * 365)
      expect(await farming.tokensLeft()).to.be.eq(totalAmount)
      expect(await farming.percentage()).to.be.eq(percentage)
      expect(await farming.startTime()).to.be.eq(startTime)
      expect(await farming.endTime()).to.be.eq(startTime + 3600 * 24 * 365)
    })

    it('Should be unable to initialize twice', async () => {
      await loadFixture(deployInitFixture)
      await expect(farming.connect(owner).initialize(totalAmount, percentage, 0, 100)).to.be.revertedWith(
        'InitializeError',
      )
    })
  })

  describe('Deposit', async () => {
    it('Should deposit without boost correctly', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await farming.connect(accounts[0]).deposit(stake, 0)
      expect(await farming.tokensLeft()).to.be.eq(totalAmount.sub(stake))
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)
    })

    it('Should deposit with boost correctly', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await boost.connect(accounts[0]).approve(farming.address, 1)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await farming.connect(accounts[0]).deposit(stake, 1)
      expect(await farming.tokensLeft()).to.be.eq(totalAmount.sub(stake))
      expect((await farming.users(accounts[0].address)).tokenId).to.be.eq(1)
      expect(await boost.getLockStatus(1)).to.be.true
    })

    it('Should be unable to deposit more tokens than left', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await expect(farming.connect(accounts[0]).deposit(totalAmount.add(1), 0)).to.be.revertedWith('TooManyTokens')
    })

    it('Should be unable to deposit too early', async () => {
      await loadFixture(deployInitFixture)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await expect(farming.connect(accounts[0]).deposit(stake, 0)).to.be.revertedWith('FarmingTimeError(0)')
    })

    it('Should be unable to deposit after farming end', async () => {
      await loadFixture(deployInitFixture)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo((await farming.startTime()).add(farmingTime))
      await expect(farming.connect(accounts[0]).deposit(stake, 0)).to.be.revertedWith('FarmingTimeError(1)')
    })

    it('Should be unable to deposit second time', async () => {
      await loadFixture(deployInitFixture)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo(await farming.startTime())
      await farming.connect(accounts[0]).deposit(stake.div(2), 0)
      await expect(farming.connect(accounts[0]).deposit(stake.div(2), 0)).to.be.revertedWith('AlreadyStaked')
    })
  })

  describe('Restake', () => {
    it('Should restake correctly', async () => {
      await loadFixture(deployInitFixture)
      const startTime = await farming.startTime()
      const expectedUnclamed = await farming.calculateClaimableAmount(
        boostMultipliers[0],
        startTime,
        startTime.add(week),
        stake,
        0,
      )
      await stakingToken.connect(accounts[1]).approve(farming.address, stake.mul(2))
      await time.increaseTo(startTime)
      await farming.connect(accounts[1]).deposit(stake, 0)
      await time.increaseTo(startTime.add(week))
      await farming.connect(accounts[1]).restake(stake)
      expect(await farming.tokensLeft()).to.be.eq(totalAmount.sub(stake.mul(2)))
      expect(await stakingToken.balanceOf(accounts[1].address)).to.be.eq(0)
      const user = await farming.users(accounts[1].address)
      expect(user.amount).to.be.equal(stake.mul(2))
      expect(user.unclaimed).to.be.equal(expectedUnclamed)
    })

    it('Should be unable to restake more tokens than left', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await stakingToken.connect(accounts[1]).approve(farming.address, stake)
      await farming.connect(accounts[1]).deposit(stake, 0)
      await expect(farming.connect(accounts[1]).restake(totalAmount.add(1))).to.be.revertedWith('TooManyTokens')
    })

    it('Should be unable to restake after farming end', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await stakingToken.connect(accounts[1]).approve(farming.address, stake)
      await farming.connect(accounts[1]).deposit(stake, 0)
      await time.increaseTo((await farming.startTime()).add(farmingTime))
      await expect(farming.connect(accounts[1]).restake(stake)).to.be.revertedWith('FarmingTimeError(1)')
    })

    it('Should be unable to restake without deposit', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())
      await stakingToken.connect(accounts[1]).approve(farming.address, stake)
      await time.increaseTo((await farming.startTime()).add(week))
      await expect(farming.connect(accounts[1]).restake(stake)).to.be.revertedWith('NotStakedYet')
    })
  })

  describe('Withdrawal and Claim', () => {
    it('Should calculate reward correctly', async () => {
      await loadFixture(deployInitFixture)
      const startTime = await farming.startTime()
      const expectedReward = stake.mul(boostMultipliers[0]).mul(percentage).div(hundredPercent).div(hundredPercent)
      expect(
        await farming.calculateClaimableAmount(boostMultipliers[0], startTime, startTime.add(week), stake, 0),
      ).to.eq(expectedReward)
    })

    it('Should withdraw correctly', async () => {
      await loadFixture(deployInitFixture)
      const elapsed = 3600 * 24
      const expectedReward = stake
        .mul(boostMultipliers[0])
        .mul(elapsed)
        .mul(percentage)
        .div(hundredPercent)
        .div(hundredPercent)
        .div(week)

      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo(await farming.startTime())
      await farming.connect(accounts[0]).deposit(stake, 0)

      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(0)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)

      await time.increaseTo((await farming.startTime()).add(elapsed))
      await farming.connect(accounts[0]).claimAndWithdraw()

      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(expectedReward)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(stake)
    })

    it('Should withdraw with boost correctly', async () => {
      await loadFixture(deployInitFixture)
      const elapsed = 3600 * 24
      const rarity = await boost.getRarity(1)
      const expectedReward = stake
        .mul(boostMultipliers[rarity])
        .mul(elapsed)
        .mul(percentage)
        .div(hundredPercent)
        .div(hundredPercent)
        .div(week)

      await boost.connect(accounts[0]).approve(farming.address, 1)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo(await farming.startTime())
      await farming.connect(accounts[0]).deposit(stake, 1)

      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(0)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)

      await time.increaseTo((await farming.startTime()).add(elapsed))
      await farming.connect(accounts[0]).claimAndWithdraw()

      expect(await boost.getLockStatus(1)).to.be.false
      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(expectedReward)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(stake)
    })

    it('Should claim correctly', async () => {
      await loadFixture(deployInitFixture)

      const elapsed = 3600 * 24
      const rarity = await boost.getRarity(1)
      const expectedReward = stake
        .mul(boostMultipliers[rarity])
        .mul(elapsed)
        .mul(percentage)
        .div(hundredPercent)
        .div(hundredPercent)
        .div(week)

      await boost.connect(accounts[0]).approve(farming.address, 1)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo(await farming.startTime())
      await farming.connect(accounts[0]).deposit(stake, 1)

      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(0)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)

      await time.increaseTo((await farming.startTime()).add(elapsed))
      await farming.connect(accounts[0]).claimRewards()

      expect(await boost.getLockStatus(1)).to.be.true
      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(expectedReward)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)
    })

    it('Should claim correctly after restake', async () => {
      const startTime = await farming.startTime()
      const expectedUnclamed = await farming.calculateClaimableAmount(
        boostMultipliers[0],
        startTime,
        startTime.add(week),
        stake,
        0,
      )
      const expectedReward = expectedUnclamed.add(
        await farming.calculateClaimableAmount(
          boostMultipliers[0],
          startTime.add(week),
          startTime.add(2 * week),
          stake.mul(2),
          0,
        ),
      )
      await loadFixture(deployInitFixture)
      await stakingToken.connect(accounts[1]).approve(farming.address, stake.mul(2))

      await time.increaseTo(startTime)
      await farming.connect(accounts[1]).deposit(stake, 0)

      await time.increaseTo(startTime.add(week))
      await farming.connect(accounts[1]).restake(stake)

      await time.increaseTo(startTime.add(2 * week))
      await farming.connect(accounts[1]).claimAndWithdraw()

      expect(await stakingToken.balanceOf(accounts[1].address)).to.be.eq(stake.mul(2))
      expect(await rewardToken.balanceOf(accounts[1].address)).to.be.eq(expectedReward)
    })

    it('Should claim correctly after endTime', async () => {
      await loadFixture(deployInitFixture)

      const elapsed = 3600 * 24 * 365 * 2
      const rarity = await boost.getRarity(1)

      await boost.connect(accounts[0]).approve(farming.address, 1)
      await stakingToken.connect(accounts[0]).approve(farming.address, stake)
      await time.increaseTo(await farming.startTime())
      await farming.connect(accounts[0]).deposit(stake, 1)

      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(0)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(0)

      const elapsedInStake = (await farming.endTime()).sub((await farming.users(accounts[0].address)).depositTime)
      const expectedReward = stake
        .mul(boostMultipliers[rarity])
        .mul(elapsedInStake)
        .mul(percentage)
        .div(week)
        .div(hundredPercent)
        .div(hundredPercent)

      await time.increaseTo((await farming.startTime()).add(elapsed))
      await farming.connect(accounts[0]).claimAndWithdraw()

      expect(await boost.getLockStatus(1)).to.be.false
      expect(await rewardToken.balanceOf(accounts[0].address)).to.be.eq(expectedReward)
      expect(await stakingToken.balanceOf(accounts[0].address)).to.be.eq(stake)
    })

    it('Should revert in case of insufficient balance', async () => {
      await loadFixture(deployInitFixture)

      await stakingToken.connect(owner).approve(farming.address, totalAmount)
      await time.increaseTo(await farming.startTime())
      await farming.connect(owner).deposit(totalAmount, 0)
      await time.increaseTo((await farming.startTime()).add(farmingTime))
      await expect(farming.connect(owner).claimAndWithdraw()).to.be.revertedWith('InsufficientBalance')
    })

    it('Should be unable to withdraw without a stake', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())

      await expect(farming.connect(accounts[1]).claimAndWithdraw()).to.be.revertedWith('NothingToWithdraw')
    })

    it('Should be unable to claim without a stake', async () => {
      await loadFixture(deployInitFixture)
      await time.increaseTo(await farming.startTime())

      await expect(farming.connect(accounts[1]).claimRewards()).to.be.revertedWith('NothingToClaim')
    })
  })
})
