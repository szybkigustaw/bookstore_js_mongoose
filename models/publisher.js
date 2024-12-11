const BookData = require("./book_data");

class BookPublisher extends BookData {
  constructor(id, name) {
    super(id, name);
  }
}

module.exports = BookPublisher;
