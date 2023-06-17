// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 *  @title BlockchainDeals
 *
 **********************************************************************************************************
 * Exchange goods for ETH safely, with friends or complete extrangers, backed by the Ethereum blockchain. *
 **********************************************************************************************************
 *
 *
 *  The Deal manager contract. Keeps track of every deal ever created and supports
 *  2 kinds of deal: Trustless and Arbitrer. Each type of deal has it's own
 *  storage and it's own set of requirements and functions.
 */
contract BlockchainDeals {
    uint constant ONE_DAY = 86400; // One day in seconds
    address payable public owner; // Owner of the contract
    uint public fee; // Public available fee for Trustless deals, can be modified. 
    uint private feeEarnings; // Storage for the contract earnings to be later withdraw. 
    ArbitrerDeal[] arbitrerDeals; // All Arbitrer Deals created.
    TrustlessDeal[] trustlessDeals; // All Trustless Deals created.

    // Event fired when any type of deal is created, works also as a DB.
    event DealCreated(string dealType, uint id, address indexed buyer, address indexed seller, address indexed arbitrer, uint expirationTime, uint value, string state);

    // States in which a Deal can be
    enum State {
        PendingArbitrerApproval,
        ArbitrerPendingBuyerConfirmarion,
        ValueClaimedExpired,
        PendingSellerDeposit,
        PendingBuyerDeposit,
        Confirmed,
        CancelledByCreator,
        Completed
    }

    // Deal types
    enum DealType {
        Trustless,
        Arbitrer
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    struct ArbitrerDeal {
        uint id;
        DealType dealType;
        address arbitrer;
        address buyer;
        address seller;
        string creator;
        uint value;
        uint creationTime;
        uint expirationTime;
        State state;
    }

    struct TrustlessDeal {
        uint id;
        DealType dealType;
        address buyer;
        address seller;
        string creator;
        uint value;
        uint buyerDeposit;
        uint sellerDeposit;
        uint creationTime;
        State state;
    }

    constructor() payable {
        owner = payable(msg.sender);
        fee = 10;
        feeEarnings = 0;
    }

    /**
     * @dev Change the owner of the contract. Only the owner of the
     * contract can call this function.
     * @param _newOwner address New owner
    */
    function changeOwner(address payable _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    /**
     * @dev Change the fee for Trustless Deals. Only the owner of the
     * contract can call this function.
     * @param _newFee uint The new fee
    */
    function changeFee(uint _newFee) external onlyOwner {
        fee = _newFee;
    }

    /**
     * @dev Withdraw the earnings of the contract so far,
     * they m ust be greater than 0. Only the owner of the
     * contract can call this function.
    */
    function withdrawFeeEarnings() external onlyOwner {
        require(feeEarnings > 0, "There are no earnings to withdraw");
        (bool sent, ) = payable(owner).call{value: feeEarnings}("");
        require(sent, "Failed to send Ether");
    }

    /******************** ARBITRER DEAL ********************/

    /**
     * @dev Retrieves a Deal fron the arbitrerDeals array by ID.
     * @param _id uint ID of the Deal
    */
    function getArbitrerDealById(uint _id) public view returns(ArbitrerDeal memory) {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal memory deal = arbitrerDeals[_id];
        return(deal);
    }


    /**
     * @dev Creates a new Arbitrer Deal as a buyer and stores it in the arbitrerDeals
     * array. Arbitrer deals require an Arbitrer (The address that will approve the deal).
     * Emits an event with Deal information.
     * @param _value uint The amount of eth the seller will receive upon Deal apporval.
     * @param _arbitrer address Address of the arbitrer tha will approve the Deal. Should be different than buyer (msg.sender) and _seller
     * @param _seller address The address that will receive the ETH value upon Deal apporval. Should be different than buyer (msg.sender) and _arbitrer
     * @param _expirationTime uint Is added to the block.timestamp to set the limit for when the deal
     * can be approved by the arbitrer. After this deadline is reached the Deal will no longer be valid
     * and it's value can be retrieved by the buyer of the Deal.
    */
    function createArbitrerDealAsBuyer(uint _value, address _arbitrer, address _seller, uint _expirationTime) external payable {
        require(_arbitrer != msg.sender && _seller != msg.sender && _seller != _arbitrer, "Buyer, seller and arbitrer should all be different");
        require(_value > 0 && _value <= msg.value, "Invalid value");
        require(_expirationTime >= ONE_DAY, "Should expire in at least a day");
        uint id = arbitrerDeals.length;
        ArbitrerDeal memory newArbitrerDeal = ArbitrerDeal(id, DealType.Arbitrer, _arbitrer, msg.sender, _seller, "buyer", _value, block.timestamp, block.timestamp + _expirationTime, State.PendingArbitrerApproval);
        arbitrerDeals.push(newArbitrerDeal);
        emit DealCreated("arbitrer", id, msg.sender, _seller, _arbitrer, block.timestamp + _expirationTime, _value, "pending_arbitrer_approval");
    }


    /**
     * @dev Creates a new Arbitrer Deal as a seller and stores it in the arbitrerDeals
     * array. Arbitrer deals require an Arbitrer (The address that will approve the deal).
     * Emits an event with Deal information.
     * @param _value uint The amount of eth the seller will receive upon Deal apporval.
     * @param _arbitrer address Address of the arbitrer tha will approve the Deal. Should be different than seller (msg.sender) and _buyer
     * @param _buyer address The address that will deposit the ETH value that the seller will receive. Should be different than seller (msg.sender) and _arbitrer
     * @param _expirationTime uint Is added to the block.timestamp to set the limit for when the deal
     * can be approved by the arbitrer. After this deadline is reached the Deal will no longer be valid
     * and it's value can be retrieved by the buyer if the value was paid.
    */
    function createArbitrerDealAsSeller(uint _value, address _arbitrer, address _buyer, uint _expirationTime) external payable {
        require(_arbitrer != msg.sender && _buyer != msg.sender && _buyer != _arbitrer, "Buyer, seller and arbitrer should all be different");
        require(_value > 0, "Invalid value");
        require(_expirationTime >= ONE_DAY, "Should expire in at least a day");
        uint id = arbitrerDeals.length;
        ArbitrerDeal memory newArbitrerDeal = ArbitrerDeal(id, DealType.Arbitrer, _arbitrer, _buyer, msg.sender, "seller", _value, block.timestamp, block.timestamp + _expirationTime, State.ArbitrerPendingBuyerConfirmarion);
        arbitrerDeals.push(newArbitrerDeal);
        emit DealCreated("arbitrer", id, _buyer, msg.sender, _arbitrer, block.timestamp + _expirationTime, _value, "pending_buyer_approval");
    }

    /**
     * @dev Cancels an arbitrer deal by seller if the buyer hasn't paid the value yet.
     * @param _id uint The id of the Arbitrer Deal to cancel.
    */
    function cancelArbitrerDealAsSeller(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(deal.seller == msg.sender, "Not allowed to cancel Deal");
        require(deal.state == State.ArbitrerPendingBuyerConfirmarion, "The deal can no longer be cancelled by the seller");
        deal.state = State.CancelledByCreator;
    }

    /**
     * @dev Confirms an arbitrer Deal by buyer, has to pay it's value
     * @param _id uint The id of the Arbitrer Deal to confirm.
    */
    function confirmArbitrerDealByBuyer(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(msg.value >= deal.value, "Invalid value");
        require(block.timestamp < deal.expirationTime, "The deal has expired");
        require(deal.state == State.ArbitrerPendingBuyerConfirmarion, "The has already been confirmed or can no longer be confirmed by buyer");
        require(deal.buyer == msg.sender, "Not allowed to confirm Deal");
        deal.state = State.PendingArbitrerApproval;
    }

    /**
     * @dev Approves the deal if it hasn't expire yet and it wasn't previously approved,
     * only the arbitrer of the Deal can call this function. It sends the Deal's value
     * to the seller and sets the Deal as completed.
     * @param _id uint The id of the Arbitrer Deal to approve.
    */
    function approveArbitrerDeal(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(deal.arbitrer == msg.sender, "Not allowed to approve Deal");
        require(block.timestamp < deal.expirationTime, "The deal has expired");
        require(deal.state == State.PendingArbitrerApproval, "The deal has already been approved, it's value claimed or the buyer hasn't paid the value yet");
        (bool sent, ) = payable(deal.seller).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.Completed;
    }

    /**
     * @dev The buyer can claim it's value if the Deal
     * is expired and it hasn't been completed yet.
     * The value of the Deal is transfered to the buyer.
     * @param _id uint The id of the Arbitrer Deal to claim.
    */
    function claimArbitrerExpired(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(deal.buyer == msg.sender, "Not allowed to claim Deal");
        require(block.timestamp > deal.expirationTime, "The deal has not expired yet");
        require(deal.state == State.PendingArbitrerApproval, "The deal has already been approved or it's value claimed");
        (bool sent, ) = payable(deal.buyer).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.ValueClaimedExpired;
    }

    /******************** TRUSTLESS DEAL ********************/

    /**
     * @dev Retrieves a Deal fron the trustlessDeals array by ID.
     * @param _id uint ID of the Turstless Deal.
    */
    function getTrustlessDealById(uint _id) public view returns(TrustlessDeal memory) {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal memory deal = trustlessDeals[_id];
        return(deal);
    }

    /**
     * @dev Creates a new Trustless Deal as a buyer and stores it in the trustlessDeals
     * array. Trustless deals require deposists by buyer and seller.
     * Emits an event with Deal information. This Deal can be canceled by the buyer
     * if the Deal hasn't been confirmed bt the seller yet.
     * @param _value uint The amount of ETH the seller will recieve upon Deal completion.
     * @param _seller address The address that will recieve the ETH value upon Deal completion. Should be different than buyer (msg.sender)
     * @param _sellerDeposit uint The amount of ETH the seller has to deposit in order to confirm the Deal.
     * @param _buyerDeposit uint The amount of ETH the buyer has to deposit in order to create the Deal.
    */
    function createTrustlessDealAsBuyer(uint _value, address _seller, uint _sellerDeposit, uint _buyerDeposit) external payable {
        require(_seller != msg.sender, "The buyer can't also be the seller");
        require(_value > 0 && _buyerDeposit >= _value && _value + _buyerDeposit <= msg.value && _sellerDeposit > 0, "Invalid value or deposit");
        uint id = trustlessDeals.length;
        TrustlessDeal memory newTrustlessDeal = TrustlessDeal(id, DealType.Trustless, msg.sender, _seller, "buyer", _value, _buyerDeposit, _sellerDeposit, block.timestamp, State.PendingSellerDeposit);
        trustlessDeals.push(newTrustlessDeal);
        emit DealCreated("trustless", id, msg.sender, _seller, address(0), block.timestamp, _value, "pending_seller_deposit");
    }

    /**
     * @dev Creates a new Trustless Deal as a seller and stores it in the trustlessDeals
     * array. Trustless deals require deposists by buyer and seller.
     * Emits an event with Deal information. This Deal can be canceled by the seller
     * if the Deal hasn't been confirmed bt the buyer yet. Forces the seller deposit to be greater
     * than 0 but _buyerDeposit can be any value grater than 0.
     * @param _value uint The amount of ETH the seller will recieve upon Deal completion.
     * @param _buyer address The address that will pay the ETH value. Should be different than seller (msg.sender)
     * @param _sellerDeposit uint The amount of ETH the seller has to deposit in order to confirm the Deal.
     * @param _buyerDeposit uint The amount of ETH the buyer has to deposit in order to create the Deal.
    */
    function createTrustlessDealAsSeller(uint _value, address _buyer, uint _sellerDeposit, uint _buyerDeposit) external payable {
        require(_buyer != msg.sender, "The buyer can't also be the seller");
        require(_value > 0 && _buyerDeposit > 0 && _sellerDeposit > 0 && _sellerDeposit <= msg.value, "Invalid value or deposit");
        uint id = trustlessDeals.length;
        TrustlessDeal memory newTrustlessDeal = TrustlessDeal(id, DealType.Trustless, _buyer, msg.sender, "seller", _value, _buyerDeposit, _sellerDeposit, block.timestamp, State.PendingBuyerDeposit);
        trustlessDeals.push(newTrustlessDeal);
        emit DealCreated("trustless", id, _buyer, msg.sender, address(0), block.timestamp, _value, "pending_buyer_deposit");
    }

    /**
     * @dev Cancel a Deal unilaterally by the buyer, only if the
     * seller hasn't made his or hers deposit yet.
     * @param _id uint ID of the Turstless Deal to cancel.
    */
    function buyerCancelTrustlessDeal(uint _id) external {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.buyer, "Only the buyer can cancel the Deal");
        require(deal.state == State.PendingSellerDeposit, "Deal can't be cancelled");
        (bool sent, ) = payable(deal.buyer).call{value: deal.buyerDeposit + deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.CancelledByCreator;
    }

    /**
     * @dev Cancel a Deal unilaterally by the seller, only if the
     * buyer hasn't made his or hers deposit yet.
     * @param _id uint ID of the Turstless Deal to cancel.
    */
    function sellerCancelTrustlessDeal(uint _id) external {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.seller, "Only the seller can cancel the Deal");
        require(deal.state == State.PendingBuyerDeposit, "Deal can't be cancelled");
        (bool sent, ) = payable(deal.seller).call{value: deal.sellerDeposit}("");
        require(sent, "Failed to send Ether");
        deal.state = State.CancelledByCreator;
    }

    /**
     * @dev Confirm a Deal by the buyer, it requires
     * the buyer to make his/hers deposit and pay the value.
     * @param _id uint ID of the Turstless Deal to confirm.
    */
    function buyerConfirmTrustless(uint _id) external payable {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.buyer, "Only the buyer can confirm the Deal");
        require(msg.value >= deal.buyerDeposit + deal.value, "Not enough ETH to confirm the Deal");
        require(deal.state == State.PendingBuyerDeposit, "Deal can't be confirmed");
        deal.state = State.Confirmed;
    }

    /**
     * @dev Confirm a Deal by the seller, it requires
     * the seller to make his/hers deposit.
     * @param _id uint ID of the Turstless Deal to confirm.
    */
    function sellerConfirmTrustless(uint _id) external payable {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.seller, "Only the seller can confirm the Deal");
        require(msg.value >= deal.sellerDeposit, "Not enough ETH to confirm the Deal");
        require(deal.state == State.PendingSellerDeposit, "Deal can't be confirmed");
        deal.state = State.Confirmed;
    }


    /**
     * @dev Complete a Deal by the buyer if the seller has
     * aleready confirmed it. The buyer gets his/her deposit back
     * and the seller gets the value of the Deal plus his/hers
     * deposit minus the fee. The Deal is set as Completed and no more actions can be taken on it.
     * @param _id uint ID of the Turstless Deal to complete.
    */
    function completeTrustlessDeal(uint _id) external {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.buyer, "Only the buyer can complete the Deal");
        require(deal.state == State.Confirmed, "Deal can't be completed");
        uint valueFee = deal.value * fee / 10000;
        feeEarnings += valueFee;
        (bool buyerDepositSent, ) = payable(deal.buyer).call{value: deal.buyerDeposit}("");
        (bool sellerValueSent, ) = payable(deal.seller).call{value: deal.sellerDeposit + deal.value - valueFee}("");
        require((buyerDepositSent && sellerValueSent), "Failed to send Ether");
        deal.state = State.Completed;
    }
}
