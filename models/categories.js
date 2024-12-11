const BookData = require("./book_data");

class BookCategory extends BookData {
  constructor(id, name, category_id) {
    super(id, name);
    this.category_id = category_id;
  }
}

module.exports = BookCategory;
