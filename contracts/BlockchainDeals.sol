// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

/**
 *  @title BlockchainDeals
 *  The Deal manager contract. Keeps track of every deal ever created and supports
 *  3 kinds of deal: Trustless, Arbitrer and Timelocked. Each type of deal has it's own
 *  storage and it's own set of requirements and functions.
 */
contract BlockchainDeals {
    address payable public owner; // Owner of the contract
    uint public fee; // Public available fee for Trustless deals, can be modified. 
    uint private feeEarnings; // Storage for the contract earnings to be later withdraw. 
    ArbitrerDeal[] arbitrerDeals; // All Arbitrer Deals created.
    TrustlessDeal[] trustlessDeals; // All Trustless Deals created.

    // Event fired when any type of deal is created, works also as a DB.
    event DealCreated(string dealType, uint id, address indexed creator, address indexed beneficiary, address indexed arbitrer, uint expirationTime, uint value, string state);

    // States in which a Deal can be
    enum State {
        PendingApproval,
        Completed,
        ValueClaimed,
        PendingBeneficiaryDeposit,
        Confirmed,
        CancelledByCreator
    }

    // Deal types
    enum DealType {
        Trustless,
        Arbitrer,
        TimeLocked
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action.");
        _;
    }

    struct ArbitrerDeal {
        uint id;
        DealType dealType;
        uint value;
        address arbitrer;
        address creator;
        address beneficiary;
        uint creationTime;
        uint expirationTime;
        State state;
    }

    struct TrustlessDeal {
        uint id;
        DealType dealType;
        uint value;
        uint beneficiaryDeposit;
        uint creatorDeposit;
        address creator;
        address beneficiary;
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
     * @dev Creates a new Arbitrer Deal and stores it in the arbitrerDeals
     * array. Arbitrer deals require an Arbitrer (The address that will approve the deal).
     * Emits an event with Deal information
     * @param _value uint The amount of eth the beneficiary will recieve upon Deal apporval.
     * @param _arbitrer address Address of the arbitrer tha will approve the Deal.
     * @param _beneficiary address The address that will recieve the ETH value upon Deal apporval.
     * @param _expirationTime uint Is added to the block.timestamp to set the limit for when the deal
     * can be approved by the arbitrer. After this deadline is reached the Deal will no longer be valid
     * and it's value can be retrieved by the creator of the Deal.
    */
    function createArbitrerDeal(uint _value, address _arbitrer, address _beneficiary, uint _expirationTime) external payable {
        require(_arbitrer != msg.sender && _beneficiary != msg.sender && _beneficiary != _arbitrer, "Creator, beneficiary and arbitrer should all be different");
        require(_value > 0 && _value <= msg.value, "Invalid value");
        require(_expirationTime > 86300, "Should expire in at least a day");
        uint id = arbitrerDeals.length;
        ArbitrerDeal memory newArbitrerDeal = ArbitrerDeal(id, DealType.Arbitrer, _value, _arbitrer, msg.sender, _beneficiary, block.timestamp, block.timestamp + _expirationTime, State.PendingApproval);
        arbitrerDeals.push(newArbitrerDeal);
        emit DealCreated("arbitrer", id, msg.sender, _beneficiary, _arbitrer, block.timestamp + _expirationTime, _value, "pending_approval");
    }

    /**
     * @dev Approves the deal if it hasn't expire yet and it wasn't previously approved,
     * only the arbitrer of the Deal can call this function. It sends the Deal's value
     * to the beneficiary and sets the Deal as completed.
     * @param _id uint The id of the Arbitrer Deal to approve.
    */
    function approveArbitrerDeal(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(deal.arbitrer == msg.sender, "Not allowed to approve Deal");
        require(block.timestamp < deal.expirationTime, "The deal has expired");
        require(deal.state == State.PendingApproval, "The deal has already been approved or it's value claimed");
        (bool sent, ) = payable(deal.beneficiary).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.Completed;
    }

    /**
     * @dev The creator of the Deal can claim it's value if the Deal
     * is expired and it hasn't been completed yet.
     * The value of the Deal is transfered to it's creator.
     * @param _id uint The id of the Arbitrer Deal to approve.
    */
    function claimArbitrerExpired(uint _id) external payable {
        require(_id < arbitrerDeals.length, "Invalid ID");
        ArbitrerDeal storage deal = arbitrerDeals[_id];
        require(deal.creator == msg.sender, "Not allowed to claim Deal");
        require(block.timestamp > deal.expirationTime, "The deal has not expired yet");
        require(deal.state == State.PendingApproval, "The deal has already been approved or it's value claimed");
        (bool sent, ) = payable(deal.creator).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.ValueClaimed;
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
     * @dev Creates a new Trustless Deal and stores it in the trustlessDeals
     * array. Trustless deals require deposists by creator and beneficiary.
     * Emits an event with Deal information. This Deal can be canceled by the creator
     * if the Deal hasn't been confirmed bt the beneficiary yet.
     * @param _value uint The amount of ETH the beneficiary will recieve upon Deal completion.
     * @param _beneficiary address The address that will recieve the ETH value upon Deal completion.
     * @param _beneficiaryDeposit uint The amount of ETH the beneficiary has to deposit in order to confirm the Deal.
     * @param _creatorDeposit uint The amount of ETH the creator has to deposit in order to create the Deal.
    */
    function createTrustlessDeal(uint _value, address _beneficiary, uint _beneficiaryDeposit, uint _creatorDeposit) external payable {
        require(_beneficiary != msg.sender, "The creator can't also be the beneficiary");
        require(_value > 0 && _creatorDeposit >= _value && _value + _creatorDeposit <= msg.value, "Invalid value or deposit");
        uint id = trustlessDeals.length;
        TrustlessDeal memory newTrustlessDeal = TrustlessDeal(id, DealType.Trustless, _value, _beneficiaryDeposit, _creatorDeposit, msg.sender, _beneficiary, block.timestamp, State.PendingBeneficiaryDeposit);
        trustlessDeals.push(newTrustlessDeal);
        emit DealCreated("trustless", id, msg.sender, _beneficiary, address(0), block.timestamp, _value, "pending_beneficiary_deposit");
    }

    /**
     * @dev Cancel a Deal unilaterally by the creator, only if the
     * beneficiary hasn't made his or hers deposit yet.
     * @param _id uint ID of the Turstless Deal to cancel.
    */
    function unilateralCancelTrustlessDeal(uint _id) external {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(deal.state == State.PendingBeneficiaryDeposit, "Deal can't be cancelled");
        require(msg.sender == deal.creator, "Only the creator can cancel the Deal");
        (bool sent, ) = payable(deal.creator).call{value: deal.creatorDeposit}("");
        require(sent, "Failed to send Ether");
        deal.state = State.CancelledByCreator;
    }

    /**
     * @dev Confirm a Deal by the beneficiary, it requires
     * the beneficiry to make his/hers deposit.
     * @param _id uint ID of the Turstless Deal to confirm.
    */
    function confirmBeneficiary(uint _id) external payable {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.beneficiary, "Only the beneficiary can confirm the Deal");
        require(msg.value >= deal.beneficiaryDeposit, "Not enough ETH to confirm deposit");
        require(deal.state == State.PendingBeneficiaryDeposit, "Deal can't be confirmed");
        deal.state = State.Confirmed;
    }

    /**
     * @dev Complete a Deal by the creator if the beneficiary has
     * aleready confirmed it. The creator gets his/her ETH back minus the
     * fee and the beneficiary gets the value of the Deal plus his/hers
     * deposit. The Deal is set as Completed and no more actions can be taken on it.
     * @param _id uint ID of the Turstless Deal to complete.
    */
    function completeTrustlessDeal(uint _id) external {
        require(_id < trustlessDeals.length, "Invalid ID");
        TrustlessDeal storage deal = trustlessDeals[_id];
        require(msg.sender == deal.creator, "Only the creator can complete the Deal");
        require(deal.state == State.Confirmed, "Deal can't be completed");
        uint valueFee = deal.value * fee / 10000;
        feeEarnings += valueFee;
        (bool creatorDepositSent, ) = payable(deal.creator).call{value: deal.creatorDeposit - valueFee}("");
        (bool beneficiaryValueSent, ) = payable(deal.beneficiary).call{value: deal.beneficiaryDeposit + deal.value}("");
        require((creatorDepositSent && beneficiaryValueSent), "Failed to send Ether");
        deal.state = State.Completed;
    }
}
