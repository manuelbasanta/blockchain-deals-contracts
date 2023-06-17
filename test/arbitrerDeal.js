const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const ONE_DAY = 86400;

describe("Arbitrer Deal", function () {
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
    describe("getArbitrerDealById", function () {
        it("should revert when trying to get deal with an invalid ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.getArbitrerDealById(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should get deal with a valid ID", async function () {
            const { blockchainDeals, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });
            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.arbitrer).to.equal(arbitrerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.id).to.equal(0);
            expect(deal.value).to.equal(value);
        });
    });

    describe("createArbitrerDealAsBuyer", function () {
        it("should revert creation with value 0", async function () {
            const { blockchainDeals, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
      
            const value = 0;
            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Invalid value"
            );
        });

        it("should revert creation with msg.value less than Deal value", async function () {
            const { blockchainDeals, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
      
            await expect(blockchainDeals.createArbitrerDealAsBuyer(10000, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value: 100
            })).to.be.revertedWith(
                "Invalid value"
            );
        });

        it("should revert creation with expiration time less than a day", async function () {
            const { blockchainDeals, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, 6400, {
                value
            })).to.be.revertedWith(
                "Should expire in at least a day"
            );
        });

        it("should revert creation with if the buyer is also the arbitrer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, buyerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should revert creation with if the buyer is also the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should revert creation with if the arbitrer is also the seller", async function () {
            const { blockchainDeals, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, arbitrerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should create arbitrer Deal", async function () {
            const { blockchainDeals, owner: buyerAccount,  otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expirationTime = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expirationTime, {
                value
            });
            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getArbitrerDealById(0);

            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.arbitrer).to.equal(arbitrerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.id).to.equal(0);
            expect(deal.value).to.equal(value);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.expirationTime).to.equal(timestamp + expirationTime);
            expect(deal.dealType).to.equal(1);
            expect(deal.state).to.equal(0);
            expect(deal.creator).to.equal("buyer");
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount,  otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expirationTime = ONE_DAY;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs("arbitrer", 0, buyerAccount.address, sellerAccount.address, arbitrerAccount.address, expirationTime + Number(timestamp), value, "pending_arbitrer_approval");
        });
    });

    describe("createArbitrerDealAsSeller", function () {
        it("should revert creation with value 0", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
      
            const value = 0;
            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Invalid value"
            );
        });

        it("should revert creation with expiration time less than a day", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, 6400, {
                value
            })).to.be.revertedWith(
                "Should expire in at least a day"
            );
        });

        it("should revert creation with if the buyer is also the arbitrer", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, buyerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should revert creation with if the buyer is also the seller", async function () {
            const { blockchainDeals, otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should revert creation with if the arbitrer is also the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 10000;
            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, sellerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            })).to.be.revertedWith(
                "Buyer, seller and arbitrer should all be different"
            );
        });

        it("should create arbitrer Deal", async function () {
            const { blockchainDeals, owner: buyerAccount,  otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expirationTime = ONE_DAY;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, expirationTime, {
                value
            });
            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            const deal = await blockchainDeals.getArbitrerDealById(0);

            expect(deal.buyer).to.equal(buyerAccount.address);
            expect(deal.arbitrer).to.equal(arbitrerAccount.address);
            expect(deal.seller).to.equal(sellerAccount.address);
            expect(deal.id).to.equal(0);
            expect(deal.value).to.equal(value);
            expect(deal.creationTime).to.equal(timestamp);
            expect(deal.expirationTime).to.equal(timestamp + expirationTime);
            expect(deal.dealType).to.equal(1);
            expect(deal.state).to.equal(1);
            expect(deal.creator).to.equal("seller");
        });

        it("should emit DealCreated event", async function () {
            const { blockchainDeals, owner: buyerAccount,  otherAccount: sellerAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expirationTime = ONE_DAY;
            const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

            await expect(blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            }))
                .to.emit(blockchainDeals, "DealCreated")
                .withArgs("arbitrer", 0, buyerAccount.address, sellerAccount.address, arbitrerAccount.address, expirationTime + Number(timestamp), value, "pending_buyer_approval");
        });
    });

    describe("approveArbitrerDeal", function () {
        it("should revert for invalid Deal ID", async function () {
            const { blockchainDeals, arbitrerAccount } = await loadFixture(deployFixture);

            await expect(blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if the msg.sender is not the arbitrer", async function () {
            const { blockchainDeals, otherAccount, arbitrerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, otherAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.connect(otherAccount).approveArbitrerDeal(0)).to.be.revertedWith(
                "Not allowed to approve Deal"
            );
        });

        it("should revert if the Deal has already expired", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });
            const {timestamp} = await hre.ethers.provider.getBlock("latest")
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration ])
            await expect(blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0)).to.be.revertedWith(
                "The deal has expired"
            );
        });

        it("should revert if the Deal state is Completed", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });
            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);

            await expect(blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0)).to.be.revertedWith(
                "The deal has already been approved, it's value claimed or the buyer hasn't paid the value yet"
            );
        });

        it("should revert if the Deal state is ArbitrerPendingBuyerConfirmarion", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, expiration);

            await expect(blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0)).to.be.revertedWith(
                "The deal has already been approved, it's value claimed or the buyer hasn't paid the value yet"
            );
        });

        it("should change Deal state to Completed", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });

            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);
            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.state).to.equal(7);
        });

        it("should send ETH to seller when created as buyer", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            const prevSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });
            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);

            const newSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            expect(newSellerBalance).to.equal(BigInt(prevSellerBalance) + BigInt(value));
        });

        it("should send ETH to seller when created as seller", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, expiration, {
                value
            });
            const prevSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            await blockchainDeals.confirmArbitrerDealByBuyer(0, {value});
            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);

            const newSellerBalance = await hre.ethers.provider.getBalance(sellerAccount.address);
            expect(newSellerBalance).to.equal(BigInt(prevSellerBalance) + BigInt(value));
        });
    });

    describe("claimArbitrerExpired", function () {
        it("should revert for invalid Deal ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);

            await expect(blockchainDeals.approveArbitrerDeal(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if the msg.sender is not the buyer", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });

            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);
            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY ]);

            await expect(blockchainDeals.connect(sellerAccount).claimArbitrerExpired(0)).to.be.revertedWith(
                "Not allowed to claim Deal"
            );
        });

        it("should revert if the Deal has not expired yet", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });

            await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                "The deal has not expired yet"
            );
        });

        it("should revert if the Deal state is Completed", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });
            await blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);
            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration ]);

            await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                "The deal has already been approved or it's value claimed"
            );
        });

        it("should revert if the Deal state is already ValueClaimed", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, expiration, {
                value
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration + 1 ]);

            await blockchainDeals.claimArbitrerExpired(0);

            await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                "The deal has already been approved or it's value claimed"
            );
        });

        it("should revert if the Deal was created by seller and not value was paid by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount,  arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            const expiration = ONE_DAY;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, expiration, {
                value
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration + 1 ]);

            await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                "The deal has already been approved or it's value claimed"
            );
        });


        it("should change Deal state to ValueClaimed if created by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY + 1 ]);

            await blockchainDeals.claimArbitrerExpired(0);

            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.state).to.equal(2);

        });

        it("should change Deal state to ValueClaimed if created by seller", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });
            await blockchainDeals.confirmArbitrerDealByBuyer(0, {value});
            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY + 1 ]);

            await blockchainDeals.claimArbitrerExpired(0);

            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.state).to.equal(2);

        });

        it("should send ETH to buyer if deal created by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY + 1 ]);

            const prevBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.claimArbitrerExpired(0);
            const receipt = await tx.wait();

            const newBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBuyerBalance).to.equal(BigInt(prevBuyerBalance) + BigInt(value) - BigInt(receipt.gasUsed));
        });

        it("should send ETH to buyer if deal created by seller", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });
            await blockchainDeals.confirmArbitrerDealByBuyer(0, {value});
            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY + 1 ]);

            const prevBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);
            const tx = await blockchainDeals.claimArbitrerExpired(0);
            const receipt = await tx.wait();

            const newBuyerBalance = await hre.ethers.provider.getBalance(buyerAccount.address);

            expect(newBuyerBalance).to.equal(BigInt(prevBuyerBalance) + BigInt(value) - BigInt(receipt.gasUsed));
        });
    });

    describe("cancelArbitrerDealAsSeller", function () {
        it("should revert for invalid Deal ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);

            await expect(blockchainDeals.cancelArbitrerDealAsSeller(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });

        it("should revert if the msg.sender is not the seller", async function () {
            const { blockchainDeals, owner: buyerAccount, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.cancelArbitrerDealAsSeller(0)).to.be.revertedWith(
                "Not allowed to cancel Deal"
            );
        });

        it("should revert if the deal was not created by seller not the seller", async function () {
            const { blockchainDeals, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.connect(sellerAccount).cancelArbitrerDealAsSeller(0)).to.be.revertedWith(
                "The deal can no longer be cancelled by the seller"
            );
        });

        it("should revert if buyer has confirmed the deal", async function () {
            const { blockchainDeals, owner: buyerAccount, arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });
            await blockchainDeals.confirmArbitrerDealByBuyer(0, {value});

            await expect(blockchainDeals.connect(sellerAccount).cancelArbitrerDealAsSeller(0)).to.be.revertedWith(
                "The deal can no longer be cancelled by the seller"
            );
        });

        it("should revert if already cancelled", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });


            await blockchainDeals.connect(sellerAccount).cancelArbitrerDealAsSeller(0);
            await expect(blockchainDeals.connect(sellerAccount).cancelArbitrerDealAsSeller(0)).to.be.revertedWith(
                "The deal can no longer be cancelled by the seller"
            );
        });

        it("should change Deal state to CancelledByCreator", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });


            await blockchainDeals.connect(sellerAccount).cancelArbitrerDealAsSeller(0);
            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.state).to.equal(6);
        });
    });

    describe("confirmArbitrerDealByBuyer", function () {
        it("should revert for invalid Deal ID", async function () {
            const { blockchainDeals } = await loadFixture(deployFixture);

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(1)).to.be.revertedWith(
                "Invalid ID"
            );
        });
        
        it("should revert if the msg.value is less than the Deal value", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(0, {value: value - 100})).to.be.revertedWith(
                "Invalid value"
            );
        });

        it("should revert if the Deal has expired", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            const {timestamp} = await hre.ethers.provider.getBlock("latest");
            hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + ONE_DAY + 1 ]);

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(0, {value})).to.be.revertedWith(
                "The deal has expired"
            );
        });

        it("should revert if msg.sender is not the buyer", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.connect(sellerAccount).confirmArbitrerDealByBuyer(0, {value})).to.be.revertedWith(
                "Not allowed to confirm Deal"
            );
        });

        it("should revert if Deal was created by buyer", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.createArbitrerDealAsBuyer(value, arbitrerAccount.address, sellerAccount.address, ONE_DAY, {
                value
            });

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(0, {value})).to.be.revertedWith(
                "The has already been confirmed or can no longer be confirmed by buyer"
            );
        });

        it("should revert if Deal already confirmed", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            blockchainDeals.confirmArbitrerDealByBuyer(0, {value});

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(0, {value})).to.be.revertedWith(
                "The has already been confirmed or can no longer be confirmed by buyer"
            );
        });

        it("should revert if Deal already approved by arbitrer", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            blockchainDeals.confirmArbitrerDealByBuyer(0, {value});
            blockchainDeals.connect(arbitrerAccount).approveArbitrerDeal(0);

            await expect(blockchainDeals.confirmArbitrerDealByBuyer(0, {value})).to.be.revertedWith(
                "The has already been confirmed or can no longer be confirmed by buyer"
            );
        });

        it("should set Deal state to PendingArbitrerApproval", async function () {
            const { blockchainDeals, owner: buyerAccount , arbitrerAccount, otherAccount: sellerAccount } = await loadFixture(deployFixture);
            const value = 1000000;
            await blockchainDeals.connect(sellerAccount).createArbitrerDealAsSeller(value, arbitrerAccount.address, buyerAccount.address, ONE_DAY, {
                value
            });

            await blockchainDeals.confirmArbitrerDealByBuyer(0, {value});
            const deal = await blockchainDeals.getArbitrerDealById(0);
            expect(deal.state).to.equal(0);
        });
    });
});