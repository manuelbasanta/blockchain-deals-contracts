const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Deployment", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount, arbitrerAccount] = await ethers.getSigners();

        const BlockchainDeals = await ethers.getContractFactory("BlockchainDeals");
        const blockchainDeals = await BlockchainDeals.deploy();

        return { blockchainDeals, owner, otherAccount, arbitrerAccount };
    }
    it("should set the right fee", async function () {
    const { blockchainDeals } = await loadFixture(deployFixture);

    expect(await blockchainDeals.fee()).to.equal(10);
    });

    it("should set the right owner", async function () {
    const { blockchainDeals, owner } = await loadFixture(deployFixture);

    expect(await blockchainDeals.owner()).to.equal(owner.address);
    });
});
