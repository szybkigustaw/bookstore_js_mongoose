class Transaction {
  constructor(id, transaction_id, user, book, quantity, discount, price_total) {
    this.id = id;
    this.transaction_id = transaction_id;
    this.user = user;
    this.book = book;
    this.quantity = quantity;
    this.discount = discount;
    this.price_total = price_total;
  }
}

module.exports = Transaction;
