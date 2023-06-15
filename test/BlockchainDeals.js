const {
    loadFixture,
  } = require("@nomicfoundation/hardhat-network-helpers");
  const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
  const { expect } = require("chai");

  describe("BlockchainDeals", function () {
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
  
    describe("Deployment", function () {
      it("should set the right fee", async function () {
        const { blockchainDeals } = await loadFixture(deployFixture);
  
        expect(await blockchainDeals.fee()).to.equal(10);
      });
  
      it("should set the right owner", async function () {
        const { blockchainDeals, owner } = await loadFixture(deployFixture);
  
        expect(await blockchainDeals.owner()).to.equal(owner.address);
      });
    });
  
    describe("Owner actions", function () {
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
            const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
          
            const value = 1000000;
            const creatorDeposit = 1200000;
            const beneficiaryDeposit = 300000;
            const fee = value * 10 / 10000;
            await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                value: creatorDeposit + value
            });

            await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});
            await blockchainDeals.completeTrustlessDeal(0);
            const prevBalance = await hre.ethers.provider.getBalance(owner.address);
            const tx = await blockchainDeals.withdrawFeeEarnings();
            const receipt = await tx.wait();
            const newBalance = await hre.ethers.provider.getBalance(owner.address);
            expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(fee) - BigInt(receipt.gasUsed));
        });
    });

    describe("Arbitrer Deal", function () {
        describe("getArbitrerDealById", function () {
            it("should revert when trying to get deal with an invalid ID", async function () {
                const { blockchainDeals } = await loadFixture(deployFixture);
          
                await expect(blockchainDeals.getArbitrerDealById(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should get deal with a valid ID", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 86400, {
                    value
                });
                const deal = await blockchainDeals.getArbitrerDealById(0);
                expect(deal.arbitrer).to.equal(owner.address);
                expect(deal.beneficiary).to.equal(otherAccount.address);
                expect(deal.id).to.equal(0);
                expect(deal.value).to.equal(value);
            });
        });

        describe("createArbitrerDeal", function () {
            it("should revert creation with value 0", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
          
                const value = 0;
                await expect(blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 86400, {
                    value
                })).to.be.revertedWith(
                    "Invalid value"
                );
            });

            it("should revert creation with msg.value less than Deal value", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
          
                await expect(blockchainDeals.createArbitrerDeal(10000, owner.address, otherAccount.address, 86400, {
                    value: 100
                })).to.be.revertedWith(
                    "Invalid value"
                );
            });

            it("should revert creation with expiration time less than a day", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 10000;
                await expect(blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 6400, {
                    value
                })).to.be.revertedWith(
                    "Should expire in at least a day"
                );
            });

            it("should create arbitrer Deal", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expirationTime = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expirationTime, {
                    value
                });
                const {timestamp} = await hre.ethers.provider.getBlock("latest")
                const deal = await blockchainDeals.getArbitrerDealById(0);

                expect(deal.creator).to.equal(owner.address);
                expect(deal.arbitrer).to.equal(owner.address);
                expect(deal.beneficiary).to.equal(otherAccount.address);
                expect(deal.id).to.equal(0);
                expect(deal.value).to.equal(value);
                expect(deal.creationTime).to.equal(timestamp);
                expect(deal.expirationTime).to.equal(timestamp + expirationTime);
                expect(deal.dealType).to.equal(1);
                expect(deal.state).to.equal(0);
            });

            it("should emit DealCreated event", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expirationTime = 86400;
                const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

                await expect(blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 86400, {
                    value
                }))
                    .to.emit(blockchainDeals, "DealCreated")
                    .withArgs("arbitrer", 0, owner.address, otherAccount.address, owner.address, expirationTime + Number(timestamp), value, "pending_approval");
            });
        });

        describe("approveArbitrerDeal", function () {
            it("should revert for invalid Deal ID", async function () {
                const { blockchainDeals } = await loadFixture(deployFixture);

                await expect(blockchainDeals.approveArbitrerDeal(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should revert if the msg.sender is not the arbitrer", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 86400, {
                    value
                });

                await expect(blockchainDeals.connect(otherAccount).approveArbitrerDeal(0)).to.be.revertedWith(
                    "Not allowed to approve Deal"
                );
            });

            it("should revert if the Deal has already expired", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });
                const {timestamp} = await hre.ethers.provider.getBlock("latest")
                hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration ])
                await expect(blockchainDeals.approveArbitrerDeal(0)).to.be.revertedWith(
                    "The deal has expired"
                );
            });

            it("should revert if the Deal state is Completed", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });
                await blockchainDeals.approveArbitrerDeal(0);

                await expect(blockchainDeals.approveArbitrerDeal(0)).to.be.revertedWith(
                    "The deal has already been approved or it's value claimed"
                );
            });

            it("should change Deal state to Completed", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });

                await blockchainDeals.approveArbitrerDeal(0);
                const deal = await blockchainDeals.getArbitrerDealById(0);
                expect(deal.state).to.equal(1);
            });

            it("should send ETH to beneficiary", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                const prevBeneficiaryBalance = await hre.ethers.provider.getBalance(otherAccount.address);
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });
                await blockchainDeals.approveArbitrerDeal(0);

                const newBeneficiaryBalance = await hre.ethers.provider.getBalance(otherAccount.address);
                expect(newBeneficiaryBalance).to.equal(BigInt(prevBeneficiaryBalance) + BigInt(value));
            });
        });

        describe("claimArbitrerExpired", function () {
            it("should revert for invalid Deal ID", async function () {
                const { blockchainDeals } = await loadFixture(deployFixture);

                await expect(blockchainDeals.approveArbitrerDeal(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should revert if the msg.sender is not the creator", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, 86400, {
                    value
                });

                await expect(blockchainDeals.connect(otherAccount).claimArbitrerExpired(0)).to.be.revertedWith(
                    "Not allowed to claim Deal"
                );
            });

            it("should revert if the Deal has not expired yet", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });

                await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                    "The deal has not expired yet"
                );
            });

            it("should revert if the Deal state is Completed", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });
                await blockchainDeals.approveArbitrerDeal(0);
                const {timestamp} = await hre.ethers.provider.getBlock("latest");
                hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration ]);

                await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                    "The deal has already been approved or it's value claimed"
                );
            });

            it("should revert if the Deal state is already ValueClaimed", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });

                const {timestamp} = await hre.ethers.provider.getBlock("latest");
                hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration + 1 ]);

                await blockchainDeals.claimArbitrerExpired(0);

                await expect(blockchainDeals.claimArbitrerExpired(0)).to.be.revertedWith(
                    "The deal has already been approved or it's value claimed"
                );
            });

            it("should change Deal state to ValueClaimed", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, owner.address, otherAccount.address, expiration, {
                    value
                });

                const {timestamp} = await hre.ethers.provider.getBlock("latest");
                hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration + 1 ]);

                await blockchainDeals.claimArbitrerExpired(0);

                const deal = await blockchainDeals.getArbitrerDealById(0);
                expect(deal.state).to.equal(2);

            });

            it("should send ETH to creator", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const expiration = 86400;
                await blockchainDeals.createArbitrerDeal(value, otherAccount.address, otherAccount.address, expiration, {
                    value
                });

                const {timestamp} = await hre.ethers.provider.getBlock("latest");
                hre.ethers.provider.send("evm_setNextBlockTimestamp", [timestamp + expiration + 1 ]);

                const prevCreatorBalance = await hre.ethers.provider.getBalance(owner.address);
                const tx = await blockchainDeals.claimArbitrerExpired(0);
                const receipt = await tx.wait();

                const newCreatorBalance = await hre.ethers.provider.getBalance(owner.address);

                expect(newCreatorBalance).to.equal(BigInt(prevCreatorBalance) + BigInt(value) - BigInt(receipt.gasUsed));
            });
        });
    });

    describe("Trustless Deal", function () {
        describe("getTrustlessDealById", function () {
            it("should revert when trying to get deal with an invalid ID", async function () {
                const { blockchainDeals } = await loadFixture(deployFixture);
          
                await expect(blockchainDeals.getTrustlessDealById(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should get deal with a valid ID", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const deposit = 1000000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, deposit, deposit , {
                    value: deposit + value
                });

                const deal = await blockchainDeals.getTrustlessDealById(0);
                expect(deal.beneficiary).to.equal(otherAccount.address);
                expect(deal.id).to.equal(0);
                expect(deal.value).to.equal(value);
                expect(deal.beneficiaryDeposit).to.equal(deposit);
                expect(deal.creatorDeposit).to.equal(deposit);
            });
        });

        describe("createTrustlessDeal", function () {
            it("should revert creation with value 0", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 0;
                const deposit = 1000;
                await expect(blockchainDeals.createTrustlessDeal(value, otherAccount.address, deposit, deposit , {
                    value: deposit + value
                })).to.be.revertedWith(
                    "Invalid value or deposit"
                );
            });

            it("should revert if creators deposit is less than value", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000;
                const deposit = 999;
                await expect(blockchainDeals.createTrustlessDeal(value, otherAccount.address, deposit, deposit , {
                    value: deposit + value
                })).to.be.revertedWith(
                    "Invalid value or deposit"
                );
            });

            it("should revert if msg.value is less than value + creator's deposit", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000;
                const deposit = 1200;
                await expect(blockchainDeals.createTrustlessDeal(value, otherAccount.address, deposit, deposit , {
                    value
                })).to.be.revertedWith(
                    "Invalid value or deposit"
                );
            });

            it("should create Trustless Deal", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;

                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });
                const {timestamp} = await hre.ethers.provider.getBlock("latest")
                const deal = await blockchainDeals.getTrustlessDealById(0);

                expect(deal.creator).to.equal(owner.address);
                expect(deal.beneficiary).to.equal(otherAccount.address);
                expect(deal.id).to.equal(0);
                expect(deal.value).to.equal(value);
                expect(deal.creationTime).to.equal(timestamp);
                expect(deal.dealType).to.equal(0);
                expect(deal.state).to.equal(3);
                expect(deal.beneficiaryDeposit).to.equal(beneficiaryDeposit);
                expect(deal.creatorDeposit).to.equal(creatorDeposit);
            });

            it("should emit DealCreated event", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                const timestamp = await hre.ethers.provider.send("evm_setNextBlockTimestamp", [1786774140])

                await expect(blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                }))
                    .to.emit(blockchainDeals, "DealCreated")
                    .withArgs("trustless", 0, owner.address, otherAccount.address, ethers.constants.AddressZero, timestamp, value, "pending_beneficiary_deposit");
            });
        });
        

        describe("unilateralCancelTrustlessDeal", function () {
            it("should revert when trying to cancel a deal with an invalid ID", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(blockchainDeals.unilateralCancelTrustlessDeal(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should revert if state is not PendingBeneficiaryDeposit", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {
                    value: beneficiaryDeposit
                });

                await expect(
                    blockchainDeals.unilateralCancelTrustlessDeal(0)
                ).to.be.revertedWith(
                    "Deal can't be cancelled"
                );
            });

            it("should revert if msg.sender is not the creator", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(
                    blockchainDeals.connect(otherAccount).unilateralCancelTrustlessDeal(0)
                ).to.be.revertedWith(
                    "Only the creator can cancel the Deal"
                );
            });

            it("should send the creators deposit to the creator", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                const prevBalance = await hre.ethers.provider.getBalance(owner.address);
                const tx = await blockchainDeals.unilateralCancelTrustlessDeal(0);
                const receipt = await tx.wait();
                const newBalance = await hre.ethers.provider.getBalance(owner.address);

                expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(creatorDeposit) - BigInt(receipt.gasUsed));
            });

            it("should change Deal state to CancelledByCreator", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.unilateralCancelTrustlessDeal(0);

                const deal = await blockchainDeals.getTrustlessDealById(0);

                expect(deal.state).to.equal(5);
            });
        });

        describe("confirmBeneficiary", async function () {
            it("should revert when trying to confirm a deal with an invalid ID", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(blockchainDeals.connect(otherAccount).confirmBeneficiary(1, {value: beneficiaryDeposit})).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should revert when trying the msg.sender is not the beneficiary", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(blockchainDeals.confirmBeneficiary(0, {value: beneficiaryDeposit})).to.be.revertedWith(
                    "Only the beneficiary can confirm the Deal"
                );
            });

            it("should revert when the msg.value is less than the beneficiary's deposit", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: 1000})).to.be.revertedWith(
                    "Not enough ETH to confirm deposit"
                );
            });

            it("should revert if state is not PendingBeneficiaryDeposit", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.unilateralCancelTrustlessDeal(0);

                await expect(blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit})).to.be.revertedWith(
                    "Deal can't be confirmed"
                );
            });

            it("should change Deal state to Confirmed", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});

                const deal = await blockchainDeals.getTrustlessDealById(0);

                expect(deal.state).to.equal(4);
            });
        });

        describe("completeTrustlessDeal", async function () {
            it("should revert when trying to confirm a deal with an invalid ID", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});

                await expect(blockchainDeals.completeTrustlessDeal(1)).to.be.revertedWith(
                    "Invalid ID"
                );
            });

            it("should revert if the msg.sender is not the creator", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});

                await expect(blockchainDeals.connect(otherAccount).completeTrustlessDeal(0)).to.be.revertedWith(
                    "Only the creator can complete the Deal"
                );
            });

            it("should revert if the Deal is not confirmed", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await expect(blockchainDeals.completeTrustlessDeal(0)).to.be.revertedWith(
                    "Deal can't be completed"
                );
            });

            it("should send the creators deposit minus the fee to the creator", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                const fee = value * 10 / 10000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});
                const prevBalance = await hre.ethers.provider.getBalance(owner.address);
                const tx = await blockchainDeals.completeTrustlessDeal(0);
                const receipt = await tx.wait();
                const newBalance = await hre.ethers.provider.getBalance(owner.address);

                expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(creatorDeposit) - BigInt(receipt.gasUsed) - BigInt(fee));
            });

            it("should send the beneficiary deposit plus the value to the beneficiary", async function () {
                const { blockchainDeals, owner, otherAccount } = await loadFixture(deployFixture);
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                const fee = value * 10 / 10000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});
                const prevBalance = await hre.ethers.provider.getBalance(otherAccount.address);
                await blockchainDeals.completeTrustlessDeal(0);
                const newBalance = await hre.ethers.provider.getBalance(otherAccount.address);

                expect(newBalance).to.equal(BigInt(prevBalance) + BigInt(beneficiaryDeposit) + BigInt(value));
            });

            it("should change Deal state to Completed", async function () {
                const { blockchainDeals, otherAccount } = await loadFixture(deployFixture);
          
                const value = 1000000;
                const creatorDeposit = 1200000;
                const beneficiaryDeposit = 300000;
                await blockchainDeals.createTrustlessDeal(value, otherAccount.address, beneficiaryDeposit, creatorDeposit, {
                    value: creatorDeposit + value
                });

                await blockchainDeals.connect(otherAccount).confirmBeneficiary(0, {value: beneficiaryDeposit});
                await blockchainDeals.completeTrustlessDeal(0);

                const deal = await blockchainDeals.getTrustlessDealById(0);

                expect(deal.state).to.equal(1);
            });
        });
    });
});
  