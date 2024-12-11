class TransactionList {
  constructor(transaction_id, transactions_list, discount) {
    (this.transaction_id = transaction_id),
      (this.transactions_list = transactions_list),
      (this.discount = discount);
  }
}

module.exports = TransactionList;
