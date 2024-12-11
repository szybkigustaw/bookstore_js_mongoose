class Book {
  constructor(
    id,
    name,
    author,
    condition,
    category,
    language,
    series,
    quantity,
    price,
    publisher
  ) {
    this.id = id;
    this.name = name;
    this.author = author;
    this.condition = condition;
    this.category = category;
    this.language = language;
    this.series = series;
    this.quantity = quantity;
    this.price = price;
    this.publisher = publisher;
  }
}

module.exports = Book;
