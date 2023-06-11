// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract BlockchainDeal {
    address payable public owner;
    ArbitrerDeal[] arbiterDeals;

    event DealCreated(string dealType, uint id, address indexed buyer, address indexed seller, address indexed arbitrer, uint expirationTime, uint value, string state);

    enum State {
        PendingApproval,
        Completed,
        ValueClaimed
    }

    enum DealType {
        Trustless,
        Arbitrer,
        TimeLocked
    }

    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    struct ArbitrerDeal {
        uint id;
        DealType dealType;
        uint value;
        address arbitrer;
        address buyer;
        address seller;
        uint creationTime;
        uint expirationTime;
        State state;
    }

    constructor() payable {
        owner = payable(msg.sender);
    }

    // Arbitrer

    function getArbitrerDealById(uint _id) public view returns(ArbitrerDeal memory) {
        ArbitrerDeal memory deal = arbiterDeals[_id];
        return(deal);
    }

    function createArbitrerDeal(uint _value, address _arbitrer, address _seller, uint _expirationTime) external payable {
        require(_value > 0 && _value <= msg.value, "Invalid value");
        uint id = arbiterDeals.length;
        ArbitrerDeal memory newArbitrerDeal = ArbitrerDeal(id, DealType.Arbitrer, _value, _arbitrer, msg.sender, _seller, block.timestamp, block.timestamp + _expirationTime, State.PendingApproval);
        arbiterDeals.push(newArbitrerDeal);
        emit DealCreated("arbitrer", id, msg.sender, _seller, _arbitrer, block.timestamp + _expirationTime, _value, "pending_approval");
    }

    function approveArbitrerDeal(uint _id) external payable {
        ArbitrerDeal storage deal = arbiterDeals[_id];
        require(deal.dealType == DealType.Arbitrer);
        require(deal.arbitrer == msg.sender, "Not allowed to approve Deal");
        require(block.timestamp < deal.expirationTime, "The deal has expired");
        require(deal.state == State.PendingApproval, "The deal has already been approved");
        (bool sent, ) = payable(deal.seller).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.Completed;
    }

    function claimArbitrerExpired(uint _id) external payable {
        ArbitrerDeal storage deal = arbiterDeals[_id];
        require(deal.buyer == msg.sender, "Not allowed to claim Deal");
        require(block.timestamp > deal.expirationTime, "The deal has not expired yet");
        (bool sent, ) = payable(deal.buyer).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.ValueClaimed;
    }
}
