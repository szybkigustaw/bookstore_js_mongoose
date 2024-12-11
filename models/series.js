const BookData = require("./book_data");

class BookSeries extends BookData {
  constructor(id, name) {
    super(id, name);
  }
}

module.exports = BookSeries;
