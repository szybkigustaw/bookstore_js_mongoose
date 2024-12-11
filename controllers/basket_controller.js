const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const DbHandler = require("../models/db_handler");

const basket_controller = express();

basket_controller.use(
  cookieSession({
    secret: process.env.COOKIE_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_SECRET]
  })
);

basket_controller.set("query parser", "simple");
basket_controller.set("view engine", "pug");
basket_controller.set("views", path.join(__dirname, "../views"));

basket_controller.get("/shopping-cart", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const db_handler = new DbHandler();
  const shopping_cart = await db_handler.getShoppingBasket(req.session.user);
  console.log(JSON.stringify(shopping_cart));

  res.render("shopping-cart", { user: req.session.user, cart: shopping_cart });
});

basket_controller.get("/add-to-cart", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const db_handler = new DbHandler();

  const book = await db_handler.getBook(req.query.book_id);
  const user = req.session.user;

  const basket_item = await db_handler.createBasketItem(user, book);

  req.session.basket = [
    ...(req.session.basket
      ? req.session.basket.filter((i) => i.id !== basket_item.id)
      : []),
    basket_item,
  ];

  res.redirect("back");
});

basket_controller.get("/decrease-cart-amount", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const basket_item_id = req.query.item_id;
  const quantity = req.query.quantity;
  const db_handler = new DbHandler();

  await db_handler.decreaseBasketItemQuantity(basket_item_id, quantity);

  req.session.basket = [
    ...(req.session.basket
      ? req.session.basket.filter((i) => i.id !== basket_item_id)
      : []),
  ];

  res.redirect("back");
});

basket_controller.get("/increase-cart-amount", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const basket_item_id = req.query.item_id;
  const quantity = req.query.quantity;
  const db_handler = new DbHandler();

  await db_handler.increaseBasketItemQuantity(basket_item_id, quantity);

  req.session.basket = [
    ...(req.session.basket
      ? req.session.basket.filter((i) => i.id !== basket_item_id)
      : []),
  ];

  res.redirect("back");
});

basket_controller.get("/remove-from-cart", async (req, res) => {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  const basket_item_id = req.query.item_id;
  const db_handler = new DbHandler();

  await db_handler.deleteBasketItem(basket_item_id);

  req.session.basket = [
    ...(req.session.basket
      ? req.session.basket.filter((i) => i.id !== basket_item_id)
      : []),
  ];

  res.redirect("back");
});

basket_controller.get("/cart-all", async (req, res) => {
  const db_handler = new DbHandler();

  if (!req.session.user) res.redirect("back");

  const user = req.session.user;

  const shopping_cart = await db_handler.getShoppingBasket(user);

  res.status(200).json(shopping_cart);
});

module.exports = basket_controller;
