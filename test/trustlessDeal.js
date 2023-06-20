const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const dealStateMapper = require("./dealData");

describe("Deal", function () {
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

    describe("getDealById", function () {
        it("should revert when trying to get deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.getDealById(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should get deal with a valid ID", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000;
            const buyerDeposit = 1100;
            const sellerDeposit = 100;
            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });
            const deal = await blockchainDeals.getDealById(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.id).to.equal(0);
            expect(deal.value).to.equal(value);
        });
    });

    describe("createDealAsBuyer", function () {
        it("should revert if seller is also buyer", async function () {
            const { blockchainDeals, owner: buyerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.createDealAsBuyer(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            })).to.be.revertedWith(
                "The buyer can't also be the seller"
            );
        });

        it("should revert if value is 0", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 0;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if deposit is less than value", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if msg.value is less than value + buyerDeposit", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit - 10
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if seller deposit is 0", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 0;

            await expect(blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should create Deal", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getDealById(0);
                
            expect(deal.id).to.equal(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.creator).to.equal("buyer");
            expect(deal.value).to.equal(value);
            expect(deal.buyerDeposit).to.equal(buyerDeposit);
            expect(deal.sellerDeposit).to.equal(sellerDeposit);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.state).to.equal(dealStateMapper.PendingSellerDeposit);
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs(0, buyerAccount.address, sellerAccount.address, timestamp, value);
        });
    });

    describe("createDealAsSeller", function () {
        it("should revert if seller is also buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            })).to.be.revertedWith(
                "The buyer can't also be the seller"
            );
        });

        it("should revert if value is 0", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 0;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if buyer's deposit is 0", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000;
            const buyerDeposit = 0;
            const sellerDeposit = 30;

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if seller's deposit is 0", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000;
            const buyerDeposit = 100;
            const sellerDeposit = 0;

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should revert if msg.value is less than seller's deposit", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit - 10
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should create Deal", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getDealById(0);
                
            expect(deal.id).to.equal(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.creator).to.equal("seller");
            expect(deal.value).to.equal(value);
            expect(deal.buyerDeposit).to.equal(buyerDeposit);
            expect(deal.sellerDeposit).to.equal(sellerDeposit);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.state).to.equal(dealStateMapper.PendingBuyerDeposit);
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs(0, buyerAccount.address, sellerAccount.address, timestamp, value);
        });
    });

    describe("buyerCancelDeal", function () {
        it("should revert when trying to cancel a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.buyerCancelDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.connect(sellerAccount).buyerCancelDeal(0)).to.be.revertedWith(
                "Only the buyer can cancel the Deal"
            );
        });

        it("should revert if the deal was created by the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.buyerCancelDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should revert if already confirmed by seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, { value: sellerDeposit});

            await expect(blockchainDeals.buyerCancelDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should send buyers deposit and value to buyers account", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            const prevBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.buyerCancelDeal(0);
            const receipt = await tx.wait();

            const newBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBuyerBalance).to.equal(BigInt(prevBuyerBalance) + BigInt(buyerDeposit) + BigInt(value) - BigInt(receipt.gasUsed));
        });

        it("should change Deal state to CancelledByCreator", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelDeal(0);

            const deal = await blockchainDeals.getDealById(0);

            expect(deal.state).to.equal(dealStateMapper.CancelledByCreator);
        });
    });

    describe("sellerCancelDeal", function () {
        it("should revert when trying to cancel a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.sellerCancelDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.sellerCancelDeal(0)).to.be.revertedWith(
                "Only the seller can cancel the Deal"
            );
        });

        it("should revert if the deal was created by the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerCancelDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should revert if already confirmed by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmDeal(0, { value: value + buyerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).sellerCancelDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should send seller's deposit to seller's account", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            const prevSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            const tx = await blockchainDeals.connect(sellerAccount).sellerCancelDeal(0);
            const receipt = await tx.wait();

            const newSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newSellerBalance).to.equal(BigInt(prevSellerBalance) + BigInt(sellerDeposit) - BigInt(receipt.gasUsed));
        });

        it("should change Deal state to CancelledByCreator", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.connect(sellerAccount).sellerCancelDeal(0);

            const deal = await blockchainDeals.getDealById(0);

            expect(deal.state).to.equal(dealStateMapper.CancelledByCreator);
        });
    });

    describe("buyerConfirmDeal", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.buyerConfirmDeal(1, {value: 100})).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).buyerConfirmDeal(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Only the buyer can confirm the Deal"
            );
        });

        it("should revert if msg.value is insufficient", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit - 10})).to.be.revertedWith(
                "Not enough ETH to confirm the Deal"
            );
        });

        it("should revert if Deal created by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal already confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit});

            await expect(blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.connect(sellerAccount).sellerCancelDeal(0);

            await expect(blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should set Deal state as Confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit});

            const deal = await blockchainDeals.getDealById(0);

            expect(deal.state).to.equal(dealStateMapper.Confirmed);
        });
    });

    describe("sellerConfirmDeal", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.sellerConfirmDeal(1, {value: 100})).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.sellerConfirmDeal(0, {value: sellerDeposit})).to.be.revertedWith(
                "Only the seller can confirm the Deal"
            );
        });

        it("should revert if msg.value is insufficient", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit - 10})).to.be.revertedWith(
                "Not enough ETH to confirm the Deal"
            );
        });

        it("should revert if Deal created by seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal already confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelDeal(0);

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should set Deal state as Confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});

            const deal = await blockchainDeals.getDealById(0);

            expect(deal.state).to.equal(dealStateMapper.Confirmed);
        });
    });

    describe("completeDeal", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.completeDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).completeDeal(0)).to.be.revertedWith(
                "Only the buyer can complete the Deal"
            );
        });

        it("should revert if deal not confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.completeDeal(0)).to.be.revertedWith(
                "Deal can't be completed"
            );
        });

        it("should revert if cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelDeal(0);

            await expect(blockchainDeals.completeDeal(0)).to.be.revertedWith(
                "Deal can't be completed"
            );
        });

        it("should send the seller deposit plus the value minus the fee to the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            const fee = value * 10 / 10000;
            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.completeDeal(0);
            const newBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(sellerDeposit) + BigInt(value) - BigInt(fee));
        });

        it("should send the seller deposit plus the value minus the fee to the seller (createDealAsSeller)", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            const fee = value * 10 / 10000;
            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.completeDeal(0);
            const newBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(sellerDeposit) + BigInt(value) - BigInt(fee));
        });

        it("should send the buyer deposit to the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.completeDeal(0);
            const receipt = await tx.wait();
            const newBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(buyerDeposit) - BigInt(receipt.gasUsed));
        });


        it("should send the buyer deposit to the buyer (createDealAsSeller)", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.connect(sellerAccount).createDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmDeal(0, {value: value + buyerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.completeDeal(0);
            const receipt = await tx.wait();
            const newBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(buyerDeposit) - BigInt(receipt.gasUsed));
        });

        it("should set the Deal state to Completed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.createDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmDeal(0, {value: sellerDeposit});
            await blockchainDeals.completeDeal(0);

            const deal = await blockchainDeals.getDealById(0);

            expect(deal.state).to.equal(dealStateMapper.Completed);
        });
    });
});