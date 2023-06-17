const hre = require("hardhat");
const SEPOLIA_CONTRACT_ADDRESS = '0xBEF7Eb6B57030D809f922654b0597831861F6CdF';
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
