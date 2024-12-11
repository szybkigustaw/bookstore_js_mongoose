const mysql = require("mysql2/promise");
const Book = require("./book");
const BookCondition = require("./condition");
const BookLanguage = require("./language");
const BookPublisher = require("./publisher");
const BookCategory = require("./categories");
const BookSeries = require("./series");
const Author = require("./author");
const User = require("./user");
const ShoppingBasketItem = require("./shopping_basket");
const Transaction = require("./transactions");
const TransactionList = require("./transaction-list");
const crypto = require("crypto");

const db_config = {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
};

class DbHandler {
  async getShoppingBasket(user) {
    const conn = await mysql.createConnection(db_config);
    let shopping_basket = [];

    await conn
      .execute("SELECT * FROM users_basket WHERE user_id = ?", [user.id])
      .then(async (rows) => {
        if (rows[0].length > 0) {
          for (let row of rows[0]) {
            console.log(row);
            const book = await this.getBook(row.book_id);
            shopping_basket.push(
              new ShoppingBasketItem(row.id, book, row.quantity)
            );
          }
        }
      });

    await conn.end();

    return shopping_basket;
  }

  async getBasketItem(id) {
    const conn = await mysql.createConnection(db_config);
    let basket_item;

    await conn
      .execute("SELECT * FROM users_basket WHERE id = ?", [id])
      .then(async (rows) => {
        if (rows[0].length > 0) {
          const book = await this.getBook(rows[0][0].book_id);
          basket_item = new ShoppingBasketItem(
            rows[0][0].id,
            book,
            rows[0][0].quantity
          );
        }
      });

    await conn.end();

    return basket_item;
  }

  async clearBasket(user) {
    const conn = await mysql.createConnection(db_config);
    let result = 0;

    await conn
      .execute("DELETE FROM users_basket WHERE user_id = ?", [user.id])
      .then((rows) => {
        if (rows[0].affectedRows > 0) {
          result++;
        }
      });

    await conn.end();
    return result;
  }

  async getTransactions(user) {
    const transactions = [];
    const conn = await mysql.createConnection(db_config);

    await conn
      .execute(
        "SELECT DISTINCT transaction_id FROM transactions WHERE user_id = ?",
        [user.id]
      )
      .then(async (rows) => {
        if (rows[0].length > 0) {
          for (let row of rows[0]) {
            transactions.push(await this.getTransaction(row.transaction_id));
          }
        }
      });

    await conn.end();
    return transactions;
  }

  async getTransaction(transaction_id) {
    const transactions = [];
    const conn = await mysql.createConnection(db_config);

    await conn
      .execute("SELECT * FROM transactions WHERE transaction_id = ?", [
        transaction_id,
      ])
      .then(async (rows) => {
        if (rows[0].length > 0) {
          for (let row of rows[0]) {
            transactions.push(
              new Transaction(
                row.id,
                transaction_id,
                await this.getUserById(row.user_id),
                await this.getBook(row.book_id),
                row.quantity,
                row.discount,
                row.price_total
              )
            );
          }
        }
      });

    await conn.end();

    const transaction_list = new TransactionList(
      transaction_id,
      transactions,
      transactions[0].discount
    );

    return transaction_list;
  }

  async createTransaction(user) {
    const user_basket = await this.getShoppingBasket(user);
    console.log(JSON.stringify(user_basket));

    const total_price = Number(
      user_basket.reduce(
        (acc, val) => acc + Number(val.book.price * val.quantity),
        0
      )
    ).toFixed(2);
    console.log("TOTAL PRICE: ", total_price);

    const discount = total_price > 200 ? 15 : total_price > 100 ? 5 : 0;

    console.log("DISCOUNT: ", discount);

    const transaction_id = crypto.randomBytes(16).toString("hex");

    const conn = await mysql.createConnection(db_config);

    const transactions = [];

    for (let item of user_basket) {
      await conn
        .execute(
          "INSERT INTO transactions (user_id, book_id, quantity, discount, price_total, transaction_id) VALUES (?,?,?,?,?,?)",
          [
            user.id,
            item.book.id,
            item.quantity,
            discount,
            Number(
              item.book.price * item.quantity -
                item.book.price * item.quantity * (discount / 100)
            ).toFixed(2),
            transaction_id,
          ]
        )
        .then(async (rows) => {
          if (rows[0].affectedRows > 0) {
            transactions.push(
              new Transaction(
                rows[0].insertId,
                transaction_id,
                user,
                item.book,
                item.quantity,
                discount,
                Number(
                  item.book.price * item.quantity -
                    item.book.price * item.quantity * (discount / 100)
                ).toFixed(2)
              )
            );
          }
        });
    }

    await conn.end();
    return transaction_id;
  }

  async increaseBasketItemQuantity(id, quantity) {
    const conn = await mysql.createConnection(db_config);
    const basket_item = await this.getBasketItem(id);

    if (!basket_item) {
      throw new Error("No such basket item found");
    }

    basket_item.quantity += Number(quantity);

    await conn
      .execute("UPDATE users_basket SET quantity = ? WHERE id = ?", [
        basket_item.quantity,
        basket_item.id,
      ])
      .then((rows) => {
        if (rows[0].affectedRows == 0) {
          throw new Error("No such basket item found");
        }
      });

    await conn.end();

    return basket_item;
  }

  async decreaseBasketItemQuantity(id, quantity) {
    const conn = await mysql.createConnection(db_config);
    const basket_item = await this.getBasketItem(id);

    if (!basket_item) {
      throw new Error("No such basket item found");
    }

    if (basket_item.quantity > quantity) {
      basket_item.quantity -= quantity;

      await conn
        .execute("UPDATE users_basket SET quantity = ? WHERE id = ?", [
          basket_item.quantity,
          basket_item.id,
        ])
        .then((rows) => {
          if (rows[0].affectedRows == 0) {
            throw new Error("No such basket item found");
          }
        });
    } else {
      basket_item = await this.deleteBasketItem(basket_item.id);
      basket_item.quantity = 0;
    }

    await conn.end();

    return basket_item;
  }

  async deleteBasketItem(id) {
    const conn = await mysql.createConnection(db_config);
    const basket_item = await this.getBasketItem(id);

    if (!basket_item) {
      throw new Error("No such basket item found");
    }

    await conn
      .execute("DELETE FROM users_basket WHERE id = ?", [basket_item.id])
      .then((rows) => {
        if (rows[0].affectedRows == 0) {
          throw new Error("No such basket item found");
        }
      });

    await conn.end();

    return basket_item;
  }

  async createBasketItem(user, book) {
    const conn = await mysql.createConnection(db_config);
    const items_in_basket = await this.isItemAlreadyInBasket(user, book);
    let basket_item;
    if (items_in_basket > 0) {
      await conn
        .execute(
          "SELECT * FROM users_basket WHERE user_id = ? AND book_id = ?",
          [user.id, book.id]
        )
        .then((rows) => {
          basket_item = new ShoppingBasketItem(
            rows[0][0].id,
            book,
            rows[0][0].quantity
          );
        });

      await conn
        .execute("UPDATE users_basket SET quantity = ? WHERE id = ?", [
          basket_item.quantity + 1,
          basket_item.id,
        ])
        .then((rows) => {
          if (rows[0].affectedRows > 0) {
            basket_item.quantity = basket_item.quantity + 1;
          }
        });
    } else {
      await conn
        .execute(
          "INSERT INTO users_basket(user_id, book_id, quantity) VALUES (?,?,?)",
          [user.id, book.id, 1]
        )
        .then((rows) => {
          if (rows[0].affectedRows > 0) {
            basket_item = new ShoppingBasketItem(rows[0].insertId, book, 1);
          }
        });
    }

    await conn.end();
    return basket_item;
  }

  async isItemAlreadyInBasket(user, book) {
    let count;
    const conn = await mysql.createConnection(db_config);

    await conn
      .execute(
        "SELECT quantity FROM users_basket WHERE user_id = ? AND book_id = ?",
        [user.id, book.id]
      )
      .then((rows) => {
        count = rows[0][0]?.quantity ?? 0;
      });

    await conn.end();

    return count;
  }

  async getUserById(user_id) {
    let user;
    const conn = await mysql.createConnection(db_config);
    await conn
      .execute("SELECT * FROM users WHERE id = ? LIMIT 1", [user_id])
      .then((row) => {
        if (row[0].length > 0) {
          user = new User(
            row[0][0].id,
            row[0][0].name,
            row[0][0].email,
            row[0][0].login,
            row[0][0].password
          );
        }
      });

    await conn.end();
    return user ?? null;
  }

  async getUser(login, password) {
    let user;
    const conn = await mysql.createConnection(db_config);
    await conn
      .execute("SELECT * FROM users WHERE login = ? AND password = ? LIMIT 1", [
        login,
        password,
      ])
      .then((row) => {
        if (row[0].length > 0) {
          user = new User(
            row[0][0].id,
            row[0][0].name,
            row[0][0].email,
            row[0][0].login,
            row[0][0].password
          );
        }
      });

    await conn.end();
    return user ?? null;
  }

  async createUser(name, email, login, password) {
    let user;
    const conn = await mysql.createConnection(db_config);
    await conn
      .execute(
        "INSERT INTO users(name, password, email, login) VALUES (?,?,?,?)",
        [name, password, email, login]
      )
      .then((result, _) => {
        user = new User(result[0].insertId, name, email, login, password);
      });

    await conn.end();
    return user;
  }

  async isLoginUsed(login) {
    let is_used = false;

    const conn = await mysql.createConnection(db_config);
    await conn
      .execute("SELECT login FROM users WHERE login = ?", [login])
      .then((rows) =>
        rows[0].length > 0 ? (is_used = true) : (is_used = false)
      );

    await conn.end();
    return is_used;
  }

  async isEmailUsed(email) {
    let is_used = false;

    const conn = await mysql.createConnection(db_config);
    await conn
      .execute("SELECT email FROM users WHERE email = ?", [email])
      .then((rows) =>
        rows[0].length > 0 ? (is_used = true) : (is_used = false)
      );

    await conn.end();
    return is_used;
  }

  async getBooks(filters = {}) {
    const books = [];
    const authors = await this.getAuthors();
    const subcategories = await this.getBookSubcategories();
    const categories = await this.getBookCategories();
    const languages = await this.getBookLanguages();
    const series = await this.getBooksSeries();
    const conditions = await this.getBookConditions();
    const publishers = await this.getBookPublishers();

    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM books")
      .then((rows) => {
        let filtered_rows = rows[0];
        if (filters.condition) {
          filtered_rows = filtered_rows.filter((row) =>
            conditions
              .filter((condition) => condition.name.includes(filters.condition))
              .find((condition) => row.book_condition === condition.id)
          );
        }
        if (filters.language) {
          filtered_rows = filtered_rows.filter(
            (row) =>
              row.language ===
              languages.find(
                (language) => language.language === filters.language
              ).id
          );
        }
        if (filters.author) {
          filtered_rows = filtered_rows.filter(
            (row) =>
              row.author_id ===
              authors
                .filter((author) => author.name.includes(filters.author))
                .find((author) => row.author_id === author.id).id
          );
        }
        if (filters.series) {
          filtered_rows = filtered_rows.filter(
            (row) =>
              row.series ===
              series
                .filter((serie) => serie.name.includes(filters.series))
                .find((serie) => row.series === serie.id).id
          );
        }
        if (filters.name) {
          filtered_rows = filtered_rows.filter((row) =>
            row.name.includes(filters.name)
          );
        }
        if (filters.publisher) {
          filtered_rows = filtered_rows.filter(
            (row) =>
              row.publisher ===
              publishers
                .filter((publisher) =>
                  publisher.name.includes(filters.publisher)
                )
                .find((publisher) => row.publisher === publisher.id).id
          );
        }
        if (filters.category) {
          filtered_rows = filtered_rows.filter(
            (row) =>
              row.category ===
                subcategories
                  .filter((category) =>
                    category.name.includes(filters.category)
                  )
                  .find((category) => row.category === category.id).id ||
              row.category ===
                categories
                  .filter((category) =>
                    category.name.includes(filters.category)
                  )
                  .find((category) => row.category === category.id).id
          );
        }

        if (filters.price && filters.price_type) {
          switch (price_type) {
            case "le":
              {
                filtered_rows = filtered_rows.filter(
                  (row) => row.price <= filters.price
                );
              }
              break;
            case "ge":
              {
                filtered_rows = filtered_rows.filter(
                  (row) => row.price >= filters.price
                );
              }
              break;
            case "eq":
              {
                filtered_rows = filtered_rows.filter(
                  (row) => row.price === filters.price
                );
              }
              break;
          }
        }

        console.log("Filtered rows:", JSON.stringify(filtered_rows));
        for (let row of filtered_rows) {
          console.log("Row:", JSON.stringify(row));
          books.push(
            new Book(
              row.id,
              row.name,
              authors.find((author) => author.id === row.author_id),
              conditions.find(
                (condition) => condition.id === row.book_condition
              ),
              subcategories.find((category) => category.id === row.category),
              languages.find((language) => language.id === row.language),
              series.find((serie) => serie.id === row.series) ?? null,
              row.quantity,
              row.price,
              publishers.find((publisher) => publisher.id === row.publisher)
            )
          );
        }
      })
      .catch((err) => {
        throw new Error("Error occurred during book loading", { cause: err });
      });

    await conn.end();

    console.log("Books:", JSON.stringify(books));
    return books;
  }

  async getBook(id) {
    let book;

    const authors = await this.getAuthors();
    const subcategories = await this.getBookSubcategories();
    const languages = await this.getBookLanguages();
    const series = await this.getBooksSeries();
    const conditions = await this.getBookConditions();
    const publishers = await this.getBookPublishers();

    const conn = await mysql.createConnection(db_config);
    await conn
      .execute("SELECT * FROM books WHERE id = ?", [id])
      .then((rows) => {
        if (rows[0].length > 0) {
          book = new Book(
            rows[0][0].id,
            rows[0][0].name,
            authors.find((author) => author.id === rows[0][0].author_id),
            conditions.find(
              (condition) => condition.id === rows[0][0].book_condition
            ),
            subcategories.find(
              (category) => category.id === rows[0][0].category
            ),
            languages.find((language) => language.id === rows[0][0].language),
            series.find((serie) => serie.id === rows[0][0].series) ?? null,
            rows[0][0].quantity,
            rows[0][0].price,
            publishers.find(
              (publisher) => publisher.id === rows[0][0].publisher
            )
          );
        }
      });

    await conn.end();
    return book;
  }

  async getAuthors() {
    const authors = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM authors").then((rows) => {
      for (let row of rows[0]) {
        authors.push(new Author(row.id, row.name));
      }
    });

    await conn.end();

    console.log("Authors:", JSON.stringify(authors));
    return authors;
  }

  async getAuthor(name) {
    let author;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM authors WHERE name = ? LIMIT 1", name)
      .then((rows) => {
        if (!rows) author = null;
        else author = new Author(rows[0].id, rows[0].name);
      });

    await conn.end();
    console.log("Author:", JSON.stringify(author));
    return author;
  }

  async getBookConditions() {
    const conditions = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_conditions").then((rows) => {
      for (let row of rows[0]) {
        conditions.push(new BookCondition(row.id, row.name));
      }
    });

    console.log("conditions:", JSON.stringify(conditions));
    await conn.end();
    return conditions;
  }

  async getBookCondition(name) {
    let condition;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM book_conditions WHERE name = ? LIMIT 1", name)
      .then((row) => {
        if (!row[0]) condition = null;
        else condition = new BookCondition(row[0].id, row[0].name);
      });

    await conn.end();
    console.log("condition:", JSON.stringify(condition));
    return condition;
  }

  async getBookLanguages() {
    const languages = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_languages").then((rows) => {
      for (let row of rows[0]) {
        languages.push(new BookLanguage(row.id, row.language));
      }
    });

    await conn.end();
    console.log("Languages:", JSON.stringify(languages));
    return languages;
  }

  async getBookLanguage(name) {
    let language;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM book_languages WHERE language = ? LIMIT 1", name)
      .then((row) => {
        if (!row[0]) language = null;
        else language = new BookLanguage(row[0].id, row[0].language);
      });

    await conn.end();
    console.log("Language:", JSON.stringify(language));
    return language;
  }

  async getBookPublishers() {
    const publishers = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_publishers").then((rows) => {
      for (let row of rows[0]) {
        publishers.push(new BookPublisher(row.id, row.name));
      }
    });

    await conn.end();
    console.log("Publishers:", JSON.stringify(publishers));
    return publishers;
  }

  async getBookPublisher(name) {
    let publisher;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM book_publishers WHERE name = ? LIMIT 1", name)
      .then((row) => {
        if (!row[0]) publisher = null;
        else publisher = new BookPublisher(row[0].id, row[0].name);
      });

    await conn.end();
    console.log("Publisher:", JSON.stringify(publisher));
    return publisher;
  }

  async getBooksSeries() {
    const series = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_series").then((rows) => {
      for (let row of rows[0]) {
        series.push(new BookSeries(row.id, row.name));
      }
    });

    await conn.end();
    console.log("Series:", JSON.stringify(series));
    return series;
  }

  async getBookSeries(name) {
    let series;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM book_series WHERE name = ? LIMIT 1", name)
      .then((row) => {
        if (!row[0]) series = null;
        else series = new BookSeries(row[0].id, row[0].name);
      });

    await conn.end();
    console.log("Series:", JSON.stringify(series));
    return series;
  }

  async getBookCategories() {
    const categories = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_categories").then((rows) => {
      for (let row of rows[0]) {
        categories.push(new BookCategory(row.id, row.name, null));
      }
    });

    await conn.end();
    console.log("Categories:", JSON.stringify(categories));
    return categories;
  }

  async getBookCategory(name) {
    let category;
    const conn = await mysql.createConnection(db_config);
    await conn
      .query("SELECT * FROM book_categories WHERE name = ? LIMIT 1", name)
      .then((row) => {
        if (!row[0]) category = null;
        else category = new BookCategory(row[0].id, row[0].name, null);
      });

    await conn.end();
    console.log("Category:", JSON.stringify(category));
    return category;
  }

  async getBookSubcategories() {
    const subcategories = [];
    const conn = await mysql.createConnection(db_config);
    await conn.query("SELECT * FROM book_subcategories").then((rows) => {
      for (let row of rows[0]) {
        subcategories.push(new BookCategory(row.id, row.name, row.category_id));
      }
    });
    await conn.end();
    console.log("Subategories:", JSON.stringify(subcategories));
    return subcategories;
  }

  async getBookSubcategoriesFromCategory(category_name) {
    const subcategories = [];
    const category = await this.getBookCategory(category_name);
    const conn = await mysql.createConnection(db_config);
    await conn
      .query(
        "SELECT * FROM book_subcategories WHERE category_id = ?",
        category.id
      )
      .then((rows) => {
        for (let row of rows[0]) {
          subcategories.push(new BookCategory(row.id, row.name, category.id));
        }
      });
    await conn.end();
    console.log("Subcategories:", JSON.stringify(subcategories));
    return subcategories;
  }
}

module.exports = DbHandler;
