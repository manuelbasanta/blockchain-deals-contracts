const hre = require("hardhat");
const SEPOLIA_CONTRACT_ADDRESS = '0xE35E7d9a4b8e01869ca2789dA9f7feB1457C8Ee4';
async function main() {
  const blockchainDeals = await hre.ethers.getContractAt("BlockchainDeals", SEPOLIA_CONTRACT_ADDRESS);
  const tx = await blockchainDeals.withdrawFeeEarnings();

  console.log(
    `Funds withdrawn: ${tx}`
  );

  console.log(JSON.stringify(tx, null, 4));
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
