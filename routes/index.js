const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Category = require("../models/Category");

// Trang chủ
router.get("/", async (req, res) => {
  try {
    // Lấy sản phẩm nổi bật
    const featuredProducts = await Product.find({ featured: true })
      .populate("category")
      .limit(8);

    // Lấy sản phẩm mới nhất
    const newProducts = await Product.find()
      .sort({ createdAt: -1 })
      .populate("category")
      .limit(8);

    // Lấy danh mục nổi bật
    const featuredCategories = await Category.find({ featured: true }).limit(6);

    res.render("index", {
      title: "Trang chủ",
      featuredProducts,
      newProducts,
      featuredCategories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", {
      title: "Lỗi máy chủ",
      error: err,
    });
  }
});

// Trang giới thiệu
router.get("/about", (req, res) => {
  res.render("about", { title: "Giới thiệu" });
});

// Trang liên hệ
router.get("/contact", (req, res) => {
  res.render("contact", { title: "Liên hệ" });
});

// Xử lý gửi thông tin liên hệ
router.post("/contact", (req, res) => {
  // TODO: Xử lý gửi email từ form liên hệ
  req.flash("success_msg", "Chúng tôi đã nhận được thông tin liên hệ của bạn!");
  res.redirect("/contact");
});

// Trang chính sách
router.get("/policy/:page", (req, res) => {
  const page = req.params.page;
  let title;

  switch (page) {
    case "privacy":
      title = "Chính sách bảo mật";
      break;
    case "terms":
      title = "Điều khoản sử dụng";
      break;
    case "shipping":
      title = "Chính sách vận chuyển";
      break;
    case "returns":
      title = "Chính sách đổi trả";
      break;
    default:
      return res.redirect("/");
  }

  res.render(`policies/${page}`, { title });
});

module.exports = router;
