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
        Completed
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

    function createArbitrerDeal(address _arbitrer, address _seller, uint _expirationTime) external payable {
        require(msg.value > 0, "Value has to be grater than 0");
        uint id = arbiterDeals.length;
        ArbitrerDeal memory newArbitrerDeal = ArbitrerDeal(id, DealType.Arbitrer, msg.value, _arbitrer, msg.sender, _seller, block.timestamp, block.timestamp + _expirationTime, State.PendingApproval);
        arbiterDeals.push(newArbitrerDeal);
        emit DealCreated("arbitrer", id, msg.sender, _seller, _arbitrer, block.timestamp + _expirationTime, msg.value, "pending_approval");
    }

    function approveArbitrerDeal(uint _id) external {
        ArbitrerDeal storage deal = arbiterDeals[_id];
        require(deal.dealType == DealType.Arbitrer);
        require(deal.arbitrer == msg.sender, "Not allowed to approve Deal");
        require(block.timestamp < deal.expirationTime, "The deal has expired");
        require(deal.state == State.PendingApproval, "The deal has already been approved");
        (bool sent, ) = payable(deal.seller).call{value: deal.value}("");
        require(sent, "Failed to send Ether");
        deal.state = State.Completed;
    }
}
