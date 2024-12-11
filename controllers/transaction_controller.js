const express = require("express");
const path = require("path");
const DbHandler = require("../models/db_handler");

const transaction_controller = express();

transaction_controller.set("query parser", "simple");
transaction_controller.set("view engine", "pug");
transaction_controller.set("views", path.join(__dirname, "../views"));

transaction_controller.get("/checkout", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const user = req.session.user;
  const db_handler = new DbHandler();

  const transaction_id = await db_handler.createTransaction(user);

  await db_handler.clearBasket(user);

  res.redirect("/summary");
});

transaction_controller.get("/summary", (req, res) => {
  res.render("summary", { user: req.session.user, cart: req.session.basket });
});

module.exports = transaction_controller;
