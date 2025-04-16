const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const passport = require("passport");
const crypto = require("crypto");
const User = require("../models/User");
const Order = require("../models/Order");
const {
  ensureAuthenticated,
  forwardAuthenticated,
} = require("../middlewares/auth");
const { sendPasswordResetEmail } = require("../utils/email");

// Login Page
router.get("/login", forwardAuthenticated, (req, res) => {
  res.render("users/login", { title: "Đăng nhập" });
});

// Register Page
router.get("/register", forwardAuthenticated, (req, res) => {
  res.render("users/register", { title: "Đăng ký" });
});

// Register Handle
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, password2 } = req.body;
    let errors = [];

    // Kiểm tra các trường bắt buộc
    if (!name || !email || !password || !password2) {
      errors.push({ msg: "Vui lòng điền vào tất cả các trường" });
    }

    // Kiểm tra mật khẩu khớp
    if (password !== password2) {
      errors.push({ msg: "Mật khẩu không khớp" });
    }

    // Kiểm tra độ dài mật khẩu
    if (password.length < 6) {
      errors.push({ msg: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    if (errors.length > 0) {
      return res.render("users/register", {
        title: "Đăng ký",
        errors,
        name,
        email,
      });
    }

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errors.push({ msg: "Email đã được đăng ký" });
      return res.render("users/register", {
        title: "Đăng ký",
        errors,
        name,
        email,
      });
    }

    // Tạo user mới
    const newUser = new User({
      name,
      email,
      password,
    });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    newUser.password = await bcrypt.hash(password, salt);
    await newUser.save();

    req.flash("success_msg", "Bạn đã đăng ký thành công và có thể đăng nhập");
    res.redirect("/users/login");
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { title: "Lỗi máy chủ", error: err });
  }
});

// Login Handle
router.post("/login", (req, res, next) => {
  passport.authenticate("local", {
    successRedirect: req.session.returnTo || "/",
    failureRedirect: "/users/login",
    failureFlash: true,
  })(req, res, next);

  // Xóa returnTo sau khi đã sử dụng
  delete req.session.returnTo;
});

// Logout Handle
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success_msg", "Bạn đã đăng xuất");
    res.redirect("/users/login");
  });
});

// Trang hồ sơ
router.get("/profile", ensureAuthenticated, (req, res) => {
  res.render("users/profile", {
    title: "Hồ sơ của tôi",
    user: req.user,
    path: req.originalUrl,
  });
});

// Cập nhật hồ sơ
router.post("/profile", ensureAuthenticated, async (req, res) => {
  try {
    const { name, phone, street, city, state, zipCode, country } = req.body;

    // Cập nhật thông tin user
    await User.findByIdAndUpdate(req.user.id, {
      name,
      phone,
      address: {
        street,
        city,
        state,
        zipCode,
        country,
      },
      updatedAt: Date.now(),
    });

    req.flash("success_msg", "Cập nhật thông tin thành công");
    res.redirect("/users/profile");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật thông tin");
    res.redirect("/users/profile");
  }
});

// Đổi mật khẩu
router.post("/change-password", ensureAuthenticated, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Kiểm tra mật khẩu mới khớp nhau
    if (newPassword !== confirmPassword) {
      req.flash("error_msg", "Mật khẩu mới không khớp");
      return res.redirect("/users/profile");
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await bcrypt.compare(currentPassword, req.user.password);
    if (!isMatch) {
      req.flash("error_msg", "Mật khẩu hiện tại không đúng");
      return res.redirect("/users/profile");
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Cập nhật mật khẩu
    await User.findByIdAndUpdate(req.user.id, {
      password: hashedPassword,
      updatedAt: Date.now(),
    });

    req.flash("success_msg", "Đã đổi mật khẩu thành công");
    res.redirect("/users/profile");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi đổi mật khẩu");
    res.redirect("/users/profile");
  }
});

// Quên mật khẩu
router.get("/forgot-password", forwardAuthenticated, (req, res) => {
  res.render("users/forgot-password", { title: "Quên mật khẩu" });
});

// Xử lý quên mật khẩu
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error_msg", "Không tìm thấy tài khoản với email này");
      return res.redirect("/users/forgot-password");
    }

    // Tạo token
    const token = crypto.randomBytes(20).toString("hex");

    // Cập nhật token cho user
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 giờ
    await user.save();

    // Gửi email với link reset password
    const resetUrl = `http://${req.headers.host}/users/reset-password/${token}`;
    await sendPasswordResetEmail(user.email, resetUrl);

    req.flash("success_msg", "Email hướng dẫn đặt lại mật khẩu đã được gửi");
    res.redirect("/users/login");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý yêu cầu");
    res.redirect("/users/forgot-password");
  }
});

// Reset password form
router.get("/reset-password/:token", async (req, res) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash(
        "error_msg",
        "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"
      );
      return res.redirect("/users/forgot-password");
    }

    res.render("users/reset-password", {
      title: "Đặt lại mật khẩu",
      token: req.params.token,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý yêu cầu");
    res.redirect("/users/forgot-password");
  }
});

// Xử lý reset password
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password, password2 } = req.body;

    // Kiểm tra mật khẩu khớp
    if (password !== password2) {
      req.flash("error_msg", "Mật khẩu không khớp");
      return res.redirect(`/users/reset-password/${req.params.token}`);
    }

    // Tìm user với token
    const user = await User.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash(
        "error_msg",
        "Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn"
      );
      return res.redirect("/users/forgot-password");
    }

    // Hash mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    req.flash(
      "success_msg",
      "Mật khẩu đã được đặt lại thành công, bạn có thể đăng nhập"
    );
    res.redirect("/users/login");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý yêu cầu");
    res.redirect("/users/forgot-password");
  }
});

// Lịch sử đơn hàng
router.get("/orders", ensureAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    res.render("users/orders", {
      title: "Đơn hàng của tôi",
      orders,
      path: req.originalUrl,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi lấy thông tin đơn hàng");
    res.redirect("/users/profile");
  }
});

// Chi tiết đơn hàng
router.get("/orders/:id", ensureAuthenticated, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "products.product"
    );

    // Kiểm tra order thuộc về user hiện tại
    if (!order || order.user.toString() !== req.user.id) {
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/users/orders");
    }

    res.render("users/order-detail", {
      title: "Chi tiết đơn hàng",
      order,
      path: "/users/orders",
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi lấy thông tin đơn hàng");
    res.redirect("/users/orders");
  }
});

// Danh sách sản phẩm yêu thích
router.get("/wishlist", ensureAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("wishlist");

    res.render("users/wishlist", {
      title: "Sản phẩm yêu thích",
      wishlist: user.wishlist,
      path: req.originalUrl,
    });
  } catch (err) {
    console.error(err);
    req.flash(
      "error_msg",
      "Có lỗi xảy ra khi lấy thông tin sản phẩm yêu thích"
    );
    res.redirect("/users/profile");
  }
});

module.exports = router;
