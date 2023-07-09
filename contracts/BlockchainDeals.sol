// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 *  @title BlockchainDeals
 *
 *****************************************************************************************************
 * Exchange goods or services safely, with friends or complete extrangers, backed by the blockchain. *
 *****************************************************************************************************
 *
 *
 *  The Deal manager contract. Keeps track of every deal ever created.
 *  
 */
contract BlockchainDeals {
    address payable public owner; // Owner of the contract
    uint public fee; // Public available fee for Deals, can be modified. 
    uint private feeEarnings; // Storage for the contract earnings to be later withdraw. 
    Deal[] deals; // All Deals created.

    // Event fired when any type of deal is created, works also as a DB.
    event DealCreated(uint id, address indexed buyer, address indexed seller, uint creationTime, uint value);

    // States in which a Deal can be
    enum State {
        PendingSellerDeposit,
        PendingBuyerDeposit,
        Confirmed,
        CancelledByCreator,
        Completed
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    struct Deal {
        uint id;
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
     * @dev Change the fee for Deals. Only the owner of the
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
        feeEarnings = 0;
    }

    /******************** DEAL ********************/

    /**
     * @dev Retrieves a Deal fron the deals array by ID.
     * @param _id uint ID of the Turstless Deal.
    */
    function getDealById(uint _id) public view returns(Deal memory) {
        require(_id < deals.length, "Invalid ID");
        Deal memory deal = deals[_id];
        return(deal);
    }

    /**
     * @dev Creates a new Deal as a buyer and stores it in the deals
     * array. deals require deposists by buyer and seller.
     * Emits an event with Deal information. This Deal can be canceled by the buyer
     * if the Deal hasn't been confirmed bt the seller yet.
     * @param _value uint The amount of ETH the seller will recieve upon Deal completion.
     * @param _seller address The address that will recieve the ETH value upon Deal completion. Should be different than buyer (msg.sender)
     * @param _sellerDeposit uint The amount of ETH the seller has to deposit in order to confirm the Deal.
     * @param _buyerDeposit uint The amount of ETH the buyer has to deposit in order to create the Deal.
    */
    function createDealAsBuyer(uint _value, address _seller, uint _sellerDeposit, uint _buyerDeposit) external payable {
        require(_seller != msg.sender, "The buyer can't also be the seller");
        require(_value > 0 && _buyerDeposit > 0 && _value + _buyerDeposit <= msg.value && _sellerDeposit > 0, "Invalid value or deposit");
        uint id = deals.length;
        Deal memory newDeal = Deal(id, msg.sender, _seller, "buyer", _value, _buyerDeposit, _sellerDeposit, block.timestamp, State.PendingSellerDeposit);
        deals.push(newDeal);
        emit DealCreated(id, msg.sender, _seller, block.timestamp, _value);
    }

    /**
     * @dev Creates a new Deal as a seller and stores it in the deals
     * array. Deals require deposists by buyer and seller.
     * Emits an event with Deal information. This Deal can be canceled by the seller
     * if the Deal hasn't been confirmed bt the buyer yet. Forces the seller deposit to be greater
     * than 0 but _buyerDeposit can be any value grater than 0.
     * @param _value uint The amount of ETH the seller will recieve upon Deal completion.
     * @param _buyer address The address that will pay the ETH value. Should be different than seller (msg.sender)
     * @param _sellerDeposit uint The amount of ETH the seller has to deposit in order to confirm the Deal.
     * @param _buyerDeposit uint The amount of ETH the buyer has to deposit in order to create the Deal.
    */
    function createDealAsSeller(uint _value, address _buyer, uint _sellerDeposit, uint _buyerDeposit) external payable {
        require(_buyer != msg.sender, "The buyer can't also be the seller");
        require(_value > 0 && _buyerDeposit > 0 && _sellerDeposit > 0 && _sellerDeposit <= msg.value, "Invalid value or deposit");
        uint id = deals.length;
        Deal memory newDeal = Deal(id, _buyer, msg.sender, "seller", _value, _buyerDeposit, _sellerDeposit, block.timestamp, State.PendingBuyerDeposit);
        deals.push(newDeal);
        emit DealCreated(id, _buyer, msg.sender, block.timestamp, _value);
    }

    /**
     * @dev Cancel a Deal unilaterally by the buyer, only if the
     * seller hasn't made his or hers deposit yet.
     * @param _id uint ID of the Turstless Deal to cancel.
    */
    function buyerCancelDeal(uint _id) external {
        require(_id < deals.length, "Invalid ID");
        Deal storage deal = deals[_id];
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
    function sellerCancelDeal(uint _id) external {
        require(_id < deals.length, "Invalid ID");
        Deal storage deal = deals[_id];
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
    function buyerConfirmDeal(uint _id) external payable {
        require(_id < deals.length, "Invalid ID");
        Deal storage deal = deals[_id];
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
    function sellerConfirmDeal(uint _id) external payable {
        require(_id < deals.length, "Invalid ID");
        Deal storage deal = deals[_id];
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
    function completeDeal(uint _id) external {
        require(_id < deals.length, "Invalid ID");
        Deal storage deal = deals[_id];
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
