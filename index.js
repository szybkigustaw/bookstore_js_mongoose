const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const queryString = require("querystring");
const book_controller = require("./controllers/book_controller");
const DbHandler = require("./models/db_handler");
const user_controller = require("./controllers/user_controller");
const basket_controller = require("./controllers/basket_controller");
const transaction_controller = require("./controllers/transaction_controller");

const notFoundHandler = (req, res, next) => {
  const statusCode = 404;
  res
    .status(statusCode)
    .render("404", { user: req.session.user, cart: req.session.basket });
};

const errorHandler = (req, res, next) => {
  const statusCode = 500;
  res
    .status(statusCode)
    .render("500", { user: req.session.user, cart: req.session.basket });
};

const app = express();

app.use("/images", express.static(path.join(__dirname, "public/images")));
app.use(cookieSession({ secret: process.env.COOKIE_SECRET, keys: [process.env.COOKIE_SECRET] }));

app.use(book_controller);
app.use(user_controller);
app.use(basket_controller);
app.use(transaction_controller);

app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

app.get("/", async (req, res) => {
  let user;
  if (req.session.user) {
    const db_handler = new DbHandler();
    user = await db_handler.getUser(
      req.session.user.login,
      req.session.user.password
    );
  }

  res.render("index", { user: user, cart: req.session.basket });
});

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(process.env.PORT, () => {
  console.log("App listens on port: ", process.env.PORT);
});
