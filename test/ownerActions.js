const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");



describe("Owner actions", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();
    
        const BlockchainDeals = await ethers.getContractFactory("BlockchainDeals");
        const blockchainDeals = await BlockchainDeals.deploy();
    
        return { blockchainDeals, owner, otherAccount };
    }
    it("should be able to change fee with changeFee", async function () {
        const { blockchainDeals } = await loadFixture(deployFixture);

        expect(await blockchainDeals.fee()).to.equal(10);
        blockchainDeals.changeFee(100);
        expect(await blockchainDeals.fee()).to.equal(100);
    });

    it("should revert fee change from not owner account", async function () {
        const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
        expect(await blockchainDeals.fee()).to.equal(10);
        blockchainDeals.connect(otherAccount).changeFee(100)
        
        await expect(blockchainDeals.connect(otherAccount).changeFee(100)).to.be.revertedWith(
        "Only the owner can perform this action."
        );
        expect(await blockchainDeals.fee()).to.equal(10);
    });

    it("should be able to change owner", async function () {
        const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
    
        expect(await blockchainDeals.owner()).to.equal(owner.address);
        blockchainDeals.changeOwner(otherAccount.address);
        expect(await blockchainDeals.owner()).to.equal(otherAccount.address);
    });

    it("should revert to change owner", async function () {
        const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
    
        expect(await blockchainDeals.owner()).to.equal(owner.address);
        await expect(blockchainDeals.connect(otherAccount).changeOwner(otherAccount.address)).to.be.revertedWith(
            "Only the owner can perform this action."
        );
        expect(await blockchainDeals.owner()).to.equal(owner.address);
    });

    it("should not be able to withdraw earnings if not owner", async function () {
        const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
        await expect(blockchainDeals.connect(otherAccount).withdrawFeeEarnings()).to.be.revertedWith(
            "Only the owner can perform this action."
        );
    });

    it("should not be able to withdraw earnings if no earnigns", async function () {
        const { blockchainDeals } = await loadFixture(deployFixture);
        await expect(blockchainDeals.withdrawFeeEarnings()).to.be.revertedWith(
            "There are no earnings to withdraw"
        );
    });

    it("should be able to withdraw earnings after deals completed", async function () {
        const { blockchainDeals, owner, otherAccount: sellerAccount } = await loadFixture(deployFixture);
        const value = 1000000;
        const buyerDeposit = 1200000;
        const sellerDeposit = 300000;
        const fee = value * 10 / 10000;
        await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
            value: buyerDeposit + value
        });

        await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});
        await blockchainDeals.completeDeal(0);

        const prevBalance = await hre.ethers.provider.getBalance(owner.address);
        const tx = await blockchainDeals.withdrawFeeEarnings();
        const receipt = await tx.wait();
        const newBalance = await hre.ethers.provider.getBalance(owner.address);
        expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(fee) - BigInt(receipt.gasUsed));
    });

    it("should not be able to withdraw earnings a withdrawal", async function () {
        const { blockchainDeals, owner, otherAccount: sellerAccount } = await loadFixture(deployFixture);
        const value = 1000000;
        const buyerDeposit = 1200000;
        const sellerDeposit = 300000;
        const fee = value * 10 / 10000;
        await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
            value: buyerDeposit + value
        });

        await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
            value: buyerDeposit + value
        });

        await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});
        await blockchainDeals.completeDeal(0);

        await blockchainDeals.withdrawFeeEarnings();
        await expect(blockchainDeals.withdrawFeeEarnings()).to.be.revertedWith(
            "There are no earnings to withdraw"
        );
    });
});
  