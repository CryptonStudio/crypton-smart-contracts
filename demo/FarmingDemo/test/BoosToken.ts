import { expect } from 'chai'
import { loadFixture, mineUpTo } from '@nomicfoundation/hardhat-network-helpers'
import { ethers } from 'hardhat'
import { BoosToken, VRFCoordinatorV2Mock } from '../typechain'
import { BoosToken__factory, VRFCoordinatorV2Mock__factory } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

// variables
let coordinator: VRFCoordinatorV2Mock
let boost: BoosToken
let owner: SignerWithAddress
let accounts: SignerWithAddress[]

describe('BoosToken', function () {
  async function deployFixture() {
    [owner, ...accounts] = await ethers.getSigners()
    const BoosToken = (await ethers.getContractFactory('BoosToken')) as BoosToken__factory
    const Coordinator = (await ethers.getContractFactory('VRFCoordinatorV2Mock')) as VRFCoordinatorV2Mock__factory

    coordinator = (await Coordinator.deploy('100000000000000000', '1000000000')) as VRFCoordinatorV2Mock
    boost = (await BoosToken.deploy(
      coordinator.address,
      1,
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
      [60, 90, 100],
    )) as BoosToken

    await coordinator.connect(owner).createSubscription()
    await coordinator.connect(owner).addConsumer(1, boost.address)
    await coordinator.connect(owner).fundSubscription(1, ethers.utils.parseEther('100'))
  }
  async function deployInitFixture() {
    [owner, ...accounts] = await ethers.getSigners()
    const BoosToken = (await ethers.getContractFactory('BoosToken')) as BoosToken__factory
    const Coordinator = (await ethers.getContractFactory('VRFCoordinatorV2Mock')) as VRFCoordinatorV2Mock__factory

    coordinator = (await Coordinator.deploy('100000000000000000', '1000000000')) as VRFCoordinatorV2Mock
    boost = (await BoosToken.deploy(
      coordinator.address,
      1,
      '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
      [60, 90, 100],
    )) as BoosToken

    await boost.connect(owner).grantRole(await boost.STAKING_ROLE(), owner.address)
    await coordinator.connect(owner).createSubscription()
    await coordinator.connect(owner).addConsumer(1, boost.address)
    await coordinator.connect(owner).fundSubscription(1, ethers.utils.parseEther('100'))
    await boost.safeMint(owner.address)

    mineUpTo((await ethers.provider.getBlockNumber()) + 3)

    await coordinator.connect(owner).fulfillRandomWords(1, boost.address)
  }

  describe('VRF', () => {
    it('Should send request', async () => {
      await loadFixture(deployFixture)
      await boost.connect(owner).safeMint(owner.address)
      await expect(boost.getRequestStatus(1)).to.be.not.reverted
    })

    it('Should revert with wrong request id', async () => {
      await loadFixture(deployFixture)
      await boost.connect(owner).safeMint(owner.address)
      await expect(boost.getRequestStatus(0)).to.be.revertedWith('WrongRequestId')
    })

    it('Should fulfill words', async () => {
      await loadFixture(deployFixture)
      await boost.connect(owner).safeMint(owner.address)

      mineUpTo((await ethers.provider.getBlockNumber()) + 3)

      await coordinator.connect(owner).fulfillRandomWords(1, boost.address)
      expect(await boost.ownerOf(1)).to.be.eq(owner.address)
      expect((await boost.getRequestStatus(1)).fulfilled).to.be.true
      expect((await boost.getRequestStatus(1)).randomWords).to.be.not.null
    })
  })

  describe('Lock', () => {
    it('Should lock and unlock tokens', async () => {
      await loadFixture(deployInitFixture)
      await boost.connect(owner).lockToken(1)
      expect(await boost.getLockStatus(1)).to.be.true
      await boost.connect(owner).unlockToken(1)
      expect(await boost.getLockStatus(1)).to.be.false
    })
    it('Should not transfer locked token', async () => {
      await loadFixture(deployInitFixture)
      await boost.connect(owner).lockToken(1)
      await expect(boost.connect(owner).transferFrom(owner.address, accounts[1].address, 1)).to.be.revertedWith(
        'TokenIsLocked',
      )
    })

    it('Should not lock twice', async () => {
      await loadFixture(deployInitFixture)
      await boost.connect(owner).lockToken(1)
      await expect(boost.connect(owner).lockToken(1)).to.be.revertedWith('TokenIsLocked')
    })

    it('Should not lock without approve', async () => {
      await loadFixture(deployInitFixture)
      await boost.connect(owner).transferFrom(owner.address, accounts[1].address, 1)
      await expect(boost.connect(owner).lockToken(1)).to.be.revertedWith('NotApprovedOrOwner')
    })
  })
})
