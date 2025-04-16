require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");

// Khởi tạo app Express
const app = express();

// Cấu hình MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/sellshop", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Đã kết nối tới MongoDB"))
  .catch((err) => console.error("Lỗi kết nối MongoDB:", err));

// Cài đặt view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Cấu hình express-ejs-layouts
app.use(expressLayouts);
app.set("layout", "layouts/main");
app.set("layout extractScripts", true);
app.set("layout extractStyles", true);

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(methodOverride("_method"));

// Cấu hình Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 1 ngày
    },
  })
);

// Cấu hình Passport
app.use(passport.initialize());
app.use(passport.session());
require("./config/passport")(passport);

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash("success_msg");
  res.locals.error_msg = req.flash("error_msg");
  res.locals.error = req.flash("error");
  res.locals.user = req.user || null;
  res.locals.cart = req.session.cart || [];
  next();
});

// Routes
app.use("/", require("./routes/index"));
app.use("/users", require("./routes/users"));
app.use("/products", require("./routes/products"));
app.use("/cart", require("./routes/cart"));
app.use("/orders", require("./routes/orders"));
app.use("/admin", require("./routes/admin"));

// 404 Handler
app.use((req, res) => {
  res.status(404).render("404", { title: "Không tìm thấy trang" });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render("error", {
    title: "Lỗi máy chủ",
    error: process.env.NODE_ENV === "production" ? {} : err,
  });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
  console.log(`Truy cập ứng dụng tại: http://localhost:${PORT}`);
  console.log(`Hoặc: http://127.0.0.1:${PORT}`);
});
