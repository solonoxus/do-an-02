const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const { ensureAuthenticated } = require("../middlewares/auth");

// Hiển thị tất cả sản phẩm
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    let query = {};

    // Lọc theo danh mục
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Lọc theo giá
    if (req.query.minPrice || req.query.maxPrice) {
      query.price = {};
      if (req.query.minPrice) {
        query.price.$gte = parseInt(req.query.minPrice);
      }
      if (req.query.maxPrice) {
        query.price.$lte = parseInt(req.query.maxPrice);
      }
    }

    // Sắp xếp
    let sort = {};
    if (req.query.sort) {
      switch (req.query.sort) {
        case "price_asc":
          sort = { price: 1 };
          break;
        case "price_desc":
          sort = { price: -1 };
          break;
        case "newest":
          sort = { createdAt: -1 };
          break;
        case "rating":
          sort = { averageRating: -1 };
          break;
        default:
          sort = { createdAt: -1 };
      }
    } else {
      sort = { createdAt: -1 };
    }

    // Tìm kiếm
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { description: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Đếm tổng số sản phẩm phù hợp với điều kiện lọc
    const total = await Product.countDocuments(query);

    // Lấy sản phẩm với phân trang
    const products = await Product.find(query)
      .populate("category")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    // Lấy tất cả danh mục để hiển thị bộ lọc
    const categories = await Category.find();

    // Tính tổng số trang
    const pages = Math.ceil(total / limit);

    res.render("products/index", {
      title: "Sản phẩm",
      products,
      categories,
      currentPage: page,
      totalPages: pages,
      totalProducts: total,
      query: req.query,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { title: "Lỗi máy chủ", error: err });
  }
});

// Chi tiết sản phẩm
router.get("/:slug", async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug })
      .populate("category")
      .populate("ratings.user", "name");

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("/products");
    }

    // Lấy sản phẩm liên quan (cùng danh mục)
    const relatedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
    }).limit(4);

    // Kiểm tra xem sản phẩm có trong wishlist của user không
    let isInWishlist = false;
    if (req.user) {
      const user = await User.findById(req.user.id);
      isInWishlist = user.wishlist.includes(product._id);
    }

    res.render("products/detail", {
      title: product.name,
      product,
      relatedProducts,
      isInWishlist,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { title: "Lỗi máy chủ", error: err });
  }
});

// Lấy sản phẩm theo danh mục
router.get("/category/:slug", async (req, res) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      req.flash("error_msg", "Không tìm thấy danh mục");
      return res.redirect("/products");
    }

    // Chuyển hướng đến trang sản phẩm với bộ lọc danh mục
    res.redirect(`/products?category=${category._id}`);
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { title: "Lỗi máy chủ", error: err });
  }
});

// Thêm đánh giá sản phẩm
router.post("/:id/review", ensureAuthenticated, async (req, res) => {
  try {
    const { rating, review } = req.body;
    const productId = req.params.id;

    // Kiểm tra rating hợp lệ
    if (rating < 1 || rating > 5) {
      req.flash("error_msg", "Đánh giá phải từ 1 đến 5 sao");
      return res.redirect(`/products/${req.params.slug}`);
    }

    const product = await Product.findById(productId);

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("/products");
    }

    // Kiểm tra xem user đã đánh giá sản phẩm này chưa
    const existingRatingIndex = product.ratings.findIndex(
      (r) => r.user.toString() === req.user.id
    );

    if (existingRatingIndex !== -1) {
      // Cập nhật đánh giá hiện có
      product.ratings[existingRatingIndex].rating = rating;
      product.ratings[existingRatingIndex].review = review;
      product.ratings[existingRatingIndex].date = Date.now();
    } else {
      // Thêm đánh giá mới
      product.ratings.push({
        user: req.user.id,
        rating: rating,
        review: review,
      });
    }

    // Cập nhật rating trung bình
    product.averageRating =
      product.ratings.reduce((sum, item) => sum + item.rating, 0) /
      product.ratings.length;

    await product.save();

    req.flash("success_msg", "Đã thêm đánh giá của bạn");
    res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi thêm đánh giá");
    res.redirect(`/products/${req.params.slug}`);
  }
});

// Thêm vào danh sách yêu thích
router.post("/:id/wishlist", ensureAuthenticated, async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user.id;

    // Tìm user
    const user = await User.findById(userId);

    // Kiểm tra xem sản phẩm đã có trong wishlist chưa
    if (user.wishlist.includes(productId)) {
      // Nếu có rồi thì xóa đi (toggle)
      user.wishlist = user.wishlist.filter((id) => id.toString() !== productId);
      await user.save();

      req.flash("success_msg", "Đã xóa sản phẩm khỏi danh sách yêu thích");
    } else {
      // Nếu chưa có thì thêm vào
      user.wishlist.push(productId);
      await user.save();

      req.flash("success_msg", "Đã thêm sản phẩm vào danh sách yêu thích");
    }

    // Redirect lại trang sản phẩm
    if (req.query.redirect) {
      return res.redirect(req.query.redirect);
    }

    const product = await Product.findById(productId);
    res.redirect(`/products/${product.slug}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật danh sách yêu thích");
    res.redirect("/products");
  }
});

module.exports = router;
