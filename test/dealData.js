// States in which a Deal can be
const dealStateMapper = {
    PendingSellerDeposit: 0,
    PendingBuyerDeposit: 1,
    Confirmed: 2,
    CancelledByCreator: 3,
    Completed: 4
}

module.exports = dealStateMapper; 