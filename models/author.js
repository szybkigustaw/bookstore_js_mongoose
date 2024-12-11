const BookData = require("./book_data");

class Author extends BookData {
  constructor(id, name) {
    super(id, name);
  }
}

module.exports = Author;
