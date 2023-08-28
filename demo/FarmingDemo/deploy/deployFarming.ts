import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import dotenv = require('dotenv')
import fs = require('fs')

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const envConfig = dotenv.parse(fs.readFileSync('.env-' + hre.network.name))
  for (const k in envConfig) {
    process.env[k] = envConfig[k]
  }

  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('Farming', {
    from: deployer,
    args: [
      process.env.STAKE_TOKEN,
      process.env.REWARD_TOKEN,
      process.env.BOOST_TOKEN,
      [1000000, 1200000, 1500000, 2000000],
    ],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
}
export default func
func.tags = ['Farming']
