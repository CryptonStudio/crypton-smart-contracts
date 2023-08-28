import './tasks'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-contract-sizer'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import 'solidity-coverage'

import * as dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/types'

dotenv.config()
let privateKey: string;
if (!process.env.PRIVATE) {
  privateKey = '446454f8eaed468404e0d89ef803740e47f0b0629c3104bbe8662348461e7f92' // unused account privateKey
} else {
  privateKey = process.env.PRIVATE;
}

const config: HardhatUserConfig = {
  solidity: '0.8.17',
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_URL ?? '',
      verify: {
        etherscan: {
          apiKey: process.env.ETHERSCAN_API_KEY,
        },
      },
      accounts:
        [privateKey]
      ,
    },
  },
  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: 'USD',
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
}

export default config
