const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

describe("Trustless Deal", function () {
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

    describe("getTrustlessDealById", function () {
        it("should revert when trying to get deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.getTrustlessDealById(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should get deal with a valid ID", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000;
            const buyerDeposit = 1100;
            const sellerDeposit = 100;
            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });
            const deal = await blockchainDeals.getTrustlessDealById(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.id).to.equal(0);
            expect(deal.value).to.equal(value);
        });
    });

    describe("createTrustlessDealAsBuyer", function () {
        it("should revert if seller is also buyer", async function () {
            const { blockchainDeals, owner: buyerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should create trustless Deal", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getTrustlessDealById(0);
                
            expect(deal.id).to.equal(0);
            expect(deal.dealType).to.equal(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.creator).to.equal("buyer");
            expect(deal.value).to.equal(value);
            expect(deal.buyerDeposit).to.equal(buyerDeposit);
            expect(deal.sellerDeposit).to.equal(sellerDeposit);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.state).to.equal(3);
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs("trustless", 0, buyerAccount.address, sellerAccount.address, ethers.constants.AddressZero, timestamp, value, "pending_seller_deposit");
        });
    });

    describe("createTrustlessDealAsSeller", function () {
        it("should revert if seller is also buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
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

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit - 10
            })).to.be.revertedWith(
                "Invalid value or deposit"
            );
        });

        it("should create trustless Deal", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getTrustlessDealById(0);
                
            expect(deal.id).to.equal(0);
            expect(deal.dealType).to.equal(0);
            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.creator).to.equal("seller");
            expect(deal.value).to.equal(value);
            expect(deal.buyerDeposit).to.equal(buyerDeposit);
            expect(deal.sellerDeposit).to.equal(sellerDeposit);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.state).to.equal(4);
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs("trustless", 0, buyerAccount.address, sellerAccount.address, ethers.constants.AddressZero, timestamp, value, "pending_buyer_deposit");
        });
    });

    describe("buyerCancelTrustlessDeal", function () {
        it("should revert when trying to cancel a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.buyerCancelTrustlessDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.connect(sellerAccount).buyerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Only the buyer can cancel the Deal"
            );
        });

        it("should revert if the deal was created by the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.buyerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should revert if already confirmed by seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, { value: sellerDeposit});

            await expect(blockchainDeals.buyerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should send buyers deposit and value to buyers account", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            const prevBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.buyerCancelTrustlessDeal(0);
            const receipt = await tx.wait();

            const newBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBuyerBalance).to.equal(BigInt(prevBuyerBalance) + BigInt(buyerDeposit) + BigInt(value) - BigInt(receipt.gasUsed));
        });

        it("should change Deal state to CancelledByCreator", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelTrustlessDeal(0);

            const deal = await blockchainDeals.getTrustlessDealById(0);

            expect(deal.state).to.equal(6);
        });
    });

    describe("sellerCancelTrustlessDeal", function () {
        it("should revert when trying to cancel a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.sellerCancelTrustlessDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.sellerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Only the seller can cancel the Deal"
            );
        });

        it("should revert if the deal was created by the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: value + buyerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should revert if already confirmed by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmTrustless(0, { value: value + buyerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).sellerCancelTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be cancelled"
            );
        });

        it("should send seller's deposit to seller's account", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            const prevSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            const tx = await blockchainDeals.connect(sellerAccount).sellerCancelTrustlessDeal(0);
            const receipt = await tx.wait();

            const newSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newSellerBalance).to.equal(BigInt(prevSellerBalance) + BigInt(sellerDeposit) - BigInt(receipt.gasUsed));
        });

        it("should change Deal state to CancelledByCreator", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.connect(sellerAccount).sellerCancelTrustlessDeal(0);

            const deal = await blockchainDeals.getTrustlessDealById(0);

            expect(deal.state).to.equal(6);
        });
    });

    describe("buyerConfirmTrustless", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.buyerConfirmTrustless(1, {value: 100})).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).buyerConfirmTrustless(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Only the buyer can confirm the Deal"
            );
        });

        it("should revert if msg.value is insufficient", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit - 10})).to.be.revertedWith(
                "Not enough ETH to confirm the Deal"
            );
        });

        it("should revert if Deal created by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal already confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit});

            await expect(blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.connect(sellerAccount).sellerCancelTrustlessDeal(0);

            await expect(blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should set Deal state as Confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit});

            const deal = await blockchainDeals.getTrustlessDealById(0);

            expect(deal.state).to.equal(5);
        });
    });

    describe("sellerConfirmTrustless", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.sellerConfirmTrustless(1, {value: 100})).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.sellerConfirmTrustless(0, {value: sellerDeposit})).to.be.revertedWith(
                "Only the seller can confirm the Deal"
            );
        });

        it("should revert if msg.value is insufficient", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit - 10})).to.be.revertedWith(
                "Not enough ETH to confirm the Deal"
            );
        });

        it("should revert if Deal created by seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal already confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should revert if Deal cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelTrustlessDeal(0);

            await expect(blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit})).to.be.revertedWith(
                "Deal can't be confirmed"
            );
        });

        it("should set Deal state as Confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});

            const deal = await blockchainDeals.getTrustlessDealById(0);

            expect(deal.state).to.equal(5);
        });
    });

    describe("completeTrustlessDeal", async function () {
        it("should revert when trying to confirm a Deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.completeTrustlessDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if not the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});

            await expect(blockchainDeals.connect(sellerAccount).completeTrustlessDeal(0)).to.be.revertedWith(
                "Only the buyer can complete the Deal"
            );
        });

        it("should revert if deal not confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await expect(blockchainDeals.completeTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be completed"
            );
        });

        it("should revert if cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
      
            const value = 100;
            const buyerDeposit = 110;
            const sellerDeposit = 30;

            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.buyerCancelTrustlessDeal(0);

            await expect(blockchainDeals.completeTrustlessDeal(0)).to.be.revertedWith(
                "Deal can't be completed"
            );
        });

        it("should send the seller deposit plus the value minus the fee to the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            const fee = value * 10 / 10000;
            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.completeTrustlessDeal(0);
            const newBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(sellerDeposit) + BigInt(value) - BigInt(fee));
        });

        it("should send the seller deposit plus the value minus the fee to the seller (createTrustlessDealAsSeller)", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            const fee = value * 10 / 10000;
            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.completeTrustlessDeal(0);
            const newBalance = await hre.ethers.provider.getBalance(sellerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(sellerDeposit) + BigInt(value) - BigInt(fee));
        });

        it("should send the buyer deposit to the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.completeTrustlessDeal(0);
            const receipt = await tx.wait();
            const newBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(buyerDeposit) - BigInt(receipt.gasUsed));
        });


        it("should send the buyer deposit to the buyer (createTrustlessDealAsSeller)", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.connect(sellerAccount).createTrustlessDealAsSeller(value, buyerAccount.address, sellerDeposit, buyerDeposit, {
                value: sellerDeposit
            });

            await blockchainDeals.buyerConfirmTrustless(0, {value: value + buyerDeposit});
            const prevBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.completeTrustlessDeal(0);
            const receipt = await tx.wait();
            const newBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(buyerDeposit) - BigInt(receipt.gasUsed));
        });

        it("should set the Deal state to Completed", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const buyerDeposit = 1200000;
            const sellerDeposit = 300000;
            await blockchainDeals.createTrustlessDealAsBuyer(value, sellerAccount.address, sellerDeposit, buyerDeposit, {
                value: buyerDeposit + value
            });

            await blockchainDeals.connect(sellerAccount).sellerConfirmTrustless(0, {value: sellerDeposit});
            await blockchainDeals.completeTrustlessDeal(0);

            const deal = await blockchainDeals.getTrustlessDealById(0);

            expect(deal.state).to.equal(7);
        });
    });
});