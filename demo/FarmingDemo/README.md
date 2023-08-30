# Boost Farming

## Table of Contents

- [Boost Farming](#boost-farming)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Environment variables](#environment-variables)
    - [Contracts `.env` file](#contracts-env-file)
  - [Contracts](#contracts)
    - [Dependencies installation](#dependencies-installation)
    - [Running the Contracts tests](#running-the-contracts-tests)
    - [Compiling the contracts](#compiling-the-contracts)
    - [Deploying the contracts on testnet](#deploying-the-contracts-on-testnet)
    - [How tests work](#how-tests-work)

## Introduction

Boost Farming - platform where you can stake your tokens and boost rewards with NFT.

## Environment variables

The project uses environment variables to configure the different packages. You must create the needed `.env` file in the root folder. **This step is mandatory and cannot be skipped, otherwise the app won't compile, run or work properly.**

### Contracts `.env` file

This is the list of the environment variables that must be set in the `packages/contracts/.env` file:

```bash
PRIVATE="" # The private key of the account to use to deploy the contracts, in case you want to run the deploy script. Must be left as an empty string if you don't want to run the deploy script.
SEPOLIA_URL=<https://sepolia.infura.io/v3/YOUR_KEY> # The url of the node to use while testing. Check the "Running the Tests" section for more info.
ETHERSCAN_API_KEY=<ETHERSCAN_API_KEY> # API Key used to verify the contracts.
```

## Contracts

The smart contracts are written in [Solidity](https://solidity.readthedocs.io/en/v0.5.3/) and are compiled/tested using [Hardhat](https://hardhat.org/).

### Dependencies installation

To install the contracts dependencies, you need to have [Node.js](https://nodejs.org/en/) installed. Then, you can run the following commands:

```bash
npm i -d
```

### Running the Contracts tests

Running the contracts tests requires a valid private key set in the .env inside packages/contracts and can be as simple as
following example(example key does not exist):

```bash
PRIVATE="80f2f0cf3f1932ff6c50760e18cfd6a22bd974b16963975f270f98a7807e2756"
```

To run the tests, you can run the following command:

```bash
npm run test
```

You should see in your terminal all the tests being executed.

If you want to test single contracts and not the whole suite, you can run one of the following commands, one for each test file:

```bash
npm run test:token # Test NFT
npm run test:farming # Test only farming
```

### Compiling the contracts

To compile the contracts, you can run the following command:

```bash
npm run compile
```

### Deploying the contracts on testnet

In order to deploy the contracts on a testnet, you can use the `deploy` script. We'll use
Sepolia testnet as the default in this readme and the repository.

For this you must have the private key in the Contracts .env set to an account which contains
ETH (or relevant currency) for the testnet that you are deploying to. This can be done via creating a new wallet with
[MetaMask](https://support.metamask.io/hc/en-us/articles/360015489531), exporting private key, set it in
.env file as the `PRIVATE` and using the [Sepolia faucet](https://sepoliafaucet.com/) to send yourself Sepolia ETH.

The faucet requires an [Alchemy](https://www.alchemy.com/) account which can be setup for free. You will also need to
setup an App inside Alchemy for Sepolia, which will give you an HTTPS url which can be set in `SEPOLIA_URL` in `.env`.

Here's an example of how to deploy the contracts on Sepolia testnet:

```bash
npx hardhat deploy --tags Boost --network sepolia
```

Once the script has finished, you can find the address of the deployed BoosToken in the `deployments` folder,
or they are prompted out to you in the terminal.

If you check in the `deployments` folder, you'll find `sepolia` folder inside of it. Then, there's a
`.json` file that contains a JSON object with the address of the deployed contract as one of the first
keys.

For deploy Farming ontract you must deploy all tokens first and set addresses in .env-sepolia.

Tags for deploy:

1. BoosToken - `Boost`
2. RewardToken - `Reward`
3. StakeToken - `Stake`
4. Farming - `Farming`

Deploy to mainnet is similar to testnet. Just use `mainnet` instead of `sepolia` and create `.env-mainnet` file

### How tests work

The tests for the contracts are written using the [Hardhat](https://hardhat.org/) framework. They are located in the `test`
