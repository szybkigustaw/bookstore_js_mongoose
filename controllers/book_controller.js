const express = require("express");
const path = require("path");
const DbHandler = require("../models/db_handler");

const book_controller = express();

book_controller.set("view engine", "pug");
book_controller.set("views", path.join(__dirname, "../views"));

book_controller.use(express.urlencoded({ extended: true }));

book_controller.get("/books", async (req, res) => {
  const filters = {
    condition: req.query.condition,
    name: req.query.name,
    author: req.query.author,
    publisher: req.query.publisher,
    series: req.query.series,
    language: req.query.language,
    category: req.query.category,
    price: Number(req.query.price),
    price_type: req.query.price_type,
  };

  try {
    const db_handler = new DbHandler();
    const books = await db_handler.getBooks(filters);
    res.render("books", {
      user: req.session.user,
      books: books,
      cart: req.session.basket,
    });
  } catch (err) {
    console.log(err.message);
    if (err.cause) console.log("Caused by: ", err.cause.message);
    res.status(500).json(err);
  }
});

book_controller.post("/books", async (req, res) => {
  const filters = {
    condition: req.body.condition,
    name: req.body.name,
    author: req.body.author,
    publisher: req.body.publisher,
    series: req.body.series,
    language: req.body.language,
    category: req.body.category,
    price: Number(req.body.price),
    price_type: req.body.price_type,
  };

  try {
    const db_handler = new DbHandler();
    const books = await db_handler.getBooks(filters);
    res.render("books", {
      user: req.session.user,
      books: books,
      cart: req.session.basket,
    });
  } catch (err) {
    console.log(err.message);
    if (err.cause) console.log("Caused by: ", err.cause.message);
    res.status(500).json(err);
  }
});
module.exports = book_controller;
