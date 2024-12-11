const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const DbHandler = require("../models/db_handler");
const crypto = require("crypto");

const user_controller = express();

user_controller.use(
  cookieSession({
    secret: process.env.COOKIE_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_SECRET]
  })
);
user_controller.use(express.urlencoded({ extended: true }));

user_controller.set("view engine", "pug");
user_controller.set("views", path.join(__dirname, "../views"));

user_controller.get("/login", async (req, res) => {
  if (req.session.user) res.redirect("/");
  const errors = req.session.errors;
  req.session.errors = null;
  res.render("login", { errors: errors ?? {} });
});

user_controller.get("/register", async (req, res) => {
  if (req.session.user) res.redirect("/");
  const errors = req.session.errors;
  req.session.errors = null;
  res.render("register", { errors: errors ?? {} });
});

user_controller.get("/account", async (req, res) => {
  if (!req.session.user) res.redirect("/login");

  const db_handler = new DbHandler();
  const transactions = await db_handler.getTransactions(req.session.user);

  res.render("account", { user: req.session.user, transactions: transactions });
});

user_controller.get("/account/update", async (req, res) => {
  if (!req.session.user) res.redirect("/login");
});

user_controller.get("/logout", async (req, res) => {
  req.session.user = null;
  res.redirect("/");
});

user_controller.post("/user-login", async (req, res) => {
  req.session.errors = null;
  const login = req.body.login;
  const password = req.body.password;

  const pwd_hash = crypto
    .pbkdf2Sync(
      password,
      process.env.PASSWORD_SALT_SECRET,
      1000,
      128,
      "sha-256"
    )
    .toString("hex");

  try {
    const db_handler = new DbHandler();
    const user = await db_handler.getUser(login, pwd_hash);

    console.log("Controller - User: ", JSON.stringify(user));

    if (user) {
      req.session.user = user;
      res.redirect("/");
      console.log("Account login: success");
    } else {
      const errors = {
        login: "Nieprawidłowy login i/lub hasło.",
        password: "Nieprawidłowy login i/lub hasło.",
      };
      req.session.errors = errors;
      res.redirect("/login");
      console.log("Account login: failure");
    }
  } catch (err) {
    res.redirect("/login");
    console.log("Account login: failure");
    console.log(err.message);
  }
});

user_controller.post("/user-register", async (req, res) => {
  req.session.errors = null;

  const login = req.body.login;
  const password = req.body.password;
  const email = req.body.email;
  const name = req.body.name;

  const db_handler = new DbHandler();

  let errors = {};
  if (login.length < 8 && login.length > 32) {
    errors.login = "Nazwa użytkownika musi mieć długość od 8 do 32 znaków.";
  }
  if (await db_handler.isLoginUsed(login)) {
    errors.login = "Nazwa użytkownika jest już zajęta.";
  }

  if (!/[a-zA-Z0-9_]+@[a-zA-Z0-9_+\.[a-zA-Z]+/.test(email)) {
    errors.email = "Adres E-Mail jest nieprawidłowy.";
  }
  if (await db_handler.isEmailUsed(email)) {
    errors.email =
      "Adres E-Mail został wykorzystany do rejestracji innego konta.";
  }

  if (
    !(
      /\d+/g.test(password) &&
      /[a-z]+/g.test(password) &&
      /[A-Z]+/g.test(password) &&
      /\W+/g.test(password)
    )
  ) {
    errors.password =
      "Hasło musi zawierać co najmniej: jedną literę małą, jedną literę dużą, jedną cyfrę i jeden znak specjalny.";
  }
  if (password.length < 8 && password.length > 32) {
    errors.password = "Hasło musi mieć długość od 8 do 32 znaków.";
  }

  try {
    if (Object.keys(errors).length !== 0) {
      req.session.errors = errors;
      console.log("Account create: failure - form");
      res.redirect("/register");
      return;
    }
    const pwd_hash = crypto
      .pbkdf2Sync(
        password,
        process.env.PASSWORD_SALT_SECRET,
        1000,
        128,
        "sha-256"
      )
      .toString("hex");
    const user = await db_handler.createUser(name, email, login, pwd_hash);
    if (user.id) {
      req.session.user = user;
      console.log("Account create: success");
      res.redirect("/");
    } else {
      console.log("Account create: failure - db_handler");
      res.redirect("/register");
    }
  } catch (err) {
    console.log("Account create: failure - internal");
    console.log(err.message);
    res.redirect("/register");
  }
});

module.exports = user_controller;
