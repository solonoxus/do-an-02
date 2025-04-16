const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const { initCart } = require("../middlewares/cart");
const { ensureAuthenticated } = require("../middlewares/auth");

// Sử dụng middleware initCart cho tất cả các route
router.use(initCart);

// Xem giỏ hàng
router.get("/", (req, res) => {
  const cart = req.session.cart || [];

  // Tính tổng tiền giỏ hàng
  const cartTotalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  res.render("cart/index", {
    title: "Giỏ hàng",
    cart: cart,
    cartTotalAmount: cartTotalAmount,
  });
});

// Thêm sản phẩm vào giỏ hàng
router.post("/add", async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const qty = parseInt(quantity) || 1;

    if (qty <= 0) {
      req.flash("error_msg", "Số lượng phải lớn hơn 0");
      return res.redirect("back");
    }

    // Lấy thông tin sản phẩm
    const product = await Product.findById(productId);

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("back");
    }

    // Kiểm tra xem sản phẩm đã có trong giỏ hàng chưa
    const cart = req.session.cart || [];
    const existingItemIndex = cart.findIndex(
      (item) => item.productId === productId
    );

    if (existingItemIndex !== -1) {
      // Nếu đã có, cập nhật số lượng
      cart[existingItemIndex].quantity += qty;

      // Kiểm tra tồn kho
      if (cart[existingItemIndex].quantity > product.stock) {
        cart[existingItemIndex].quantity = product.stock;
        req.flash("error_msg", `Chỉ còn ${product.stock} sản phẩm trong kho`);
      } else {
        req.flash("success_msg", "Đã cập nhật sản phẩm trong giỏ hàng");
      }
    } else {
      // Nếu chưa có, thêm mới
      // Kiểm tra tồn kho
      const actualQty = qty > product.stock ? product.stock : qty;

      // Thêm vào giỏ hàng
      cart.push({
        productId: productId,
        name: product.name,
        price: product.salePrice || product.price,
        quantity: actualQty,
        image: product.mainImage,
        slug: product.slug,
      });

      if (actualQty < qty) {
        req.flash("error_msg", `Chỉ còn ${product.stock} sản phẩm trong kho`);
      } else {
        req.flash("success_msg", "Đã thêm sản phẩm vào giỏ hàng");
      }
    }

    // Cập nhật giỏ hàng trong session
    req.session.cart = cart;

    // Redirect theo tham số hoặc về trang giỏ hàng
    if (req.body.redirect) {
      res.redirect(req.body.redirect);
    } else {
      res.redirect("/cart");
    }
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi thêm vào giỏ hàng");
    res.redirect("back");
  }
});

// Cập nhật số lượng sản phẩm trong giỏ hàng
router.post("/update", (req, res) => {
  try {
    const { items } = req.body;
    const cart = req.session.cart || [];

    // Kiểm tra danh sách items
    if (!items || !Array.isArray(items)) {
      req.flash("error_msg", "Dữ liệu không hợp lệ");
      return res.redirect("/cart");
    }

    // Cập nhật số lượng
    items.forEach((item) => {
      const index = cart.findIndex((i) => i.productId === item.productId);
      if (index !== -1) {
        const qty = parseInt(item.quantity);
        if (qty > 0) {
          cart[index].quantity = qty;
        } else {
          // Nếu số lượng <= 0, xóa sản phẩm khỏi giỏ hàng
          cart.splice(index, 1);
        }
      }
    });

    // Cập nhật giỏ hàng trong session
    req.session.cart = cart;

    req.flash("success_msg", "Giỏ hàng đã được cập nhật");
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật giỏ hàng");
    res.redirect("/cart");
  }
});

// Xóa sản phẩm khỏi giỏ hàng
router.post("/remove", (req, res) => {
  try {
    const { productId } = req.body;
    let cart = req.session.cart || [];

    // Xóa sản phẩm khỏi giỏ hàng
    cart = cart.filter((item) => item.productId !== productId);

    // Cập nhật giỏ hàng trong session
    req.session.cart = cart;

    req.flash("success_msg", "Đã xóa sản phẩm khỏi giỏ hàng");
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xóa sản phẩm");
    res.redirect("/cart");
  }
});

// Xóa toàn bộ giỏ hàng
router.post("/clear", (req, res) => {
  // Xóa giỏ hàng trong session
  req.session.cart = [];

  req.flash("success_msg", "Đã xóa toàn bộ giỏ hàng");
  res.redirect("/cart");
});

// Trang thanh toán
router.get("/checkout", ensureAuthenticated, (req, res) => {
  const cart = req.session.cart || [];

  // Nếu giỏ hàng trống, chuyển hướng về trang giỏ hàng
  if (cart.length === 0) {
    req.flash("error_msg", "Giỏ hàng của bạn đang trống");
    return res.redirect("/cart");
  }

  // Tính tổng tiền
  const totalAmount = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  res.render("cart/checkout", {
    title: "Thanh toán",
    cart,
    totalAmount,
    user: req.user,
  });
});

module.exports = router;
