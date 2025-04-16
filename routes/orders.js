const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const { ensureAuthenticated } = require("../middlewares/auth");
const { initCart } = require("../middlewares/cart");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Sử dụng middleware
router.use(ensureAuthenticated);
router.use(initCart);

// Xử lý đặt hàng
router.post("/create", async (req, res) => {
  try {
    const {
      name,
      phone,
      street,
      city,
      state,
      zipCode,
      country,
      paymentMethod,
      notes,
    } = req.body;

    // Lấy giỏ hàng từ session
    const cart = req.session.cart || [];

    if (cart.length === 0) {
      req.flash("error_msg", "Giỏ hàng của bạn đang trống");
      return res.redirect("/cart");
    }

    // Kiểm tra thông tin giao hàng
    if (!name || !phone || !street || !city || !state || !zipCode || !country) {
      req.flash("error_msg", "Vui lòng điền đầy đủ thông tin giao hàng");
      return res.redirect("/cart/checkout");
    }

    // Kiểm tra phương thức thanh toán
    if (!["credit_card", "paypal", "cod"].includes(paymentMethod)) {
      req.flash("error_msg", "Phương thức thanh toán không hợp lệ");
      return res.redirect("/cart/checkout");
    }

    // Tính tổng tiền
    const totalAmount = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // Chuẩn bị thông tin sản phẩm cho đơn hàng
    const orderProducts = await Promise.all(
      cart.map(async (item) => {
        const product = await Product.findById(item.productId);

        if (!product) {
          throw new Error(`Không tìm thấy sản phẩm với ID ${item.productId}`);
        }

        // Kiểm tra tồn kho
        if (product.stock < item.quantity) {
          throw new Error(
            `Sản phẩm ${product.name} chỉ còn ${product.stock} trong kho`
          );
        }

        // Cập nhật tồn kho
        product.stock -= item.quantity;
        await product.save();

        return {
          product: item.productId,
          name: product.name,
          price: item.price,
          quantity: item.quantity,
        };
      })
    );

    // Tạo đơn hàng mới
    const newOrder = new Order({
      user: req.user.id,
      products: orderProducts,
      totalAmount,
      shippingAddress: {
        name,
        phone,
        street,
        city,
        state,
        zipCode,
        country,
      },
      paymentMethod,
      notes,
    });

    // Xử lý thanh toán dựa trên phương thức
    if (paymentMethod === "credit_card") {
      // Nếu thanh toán bằng thẻ, chuyển sang trang thanh toán
      req.session.pendingOrder = newOrder;
      return res.redirect("/orders/payment");
    } else if (paymentMethod === "paypal") {
      // Nếu thanh toán qua PayPal, chuyển sang trang PayPal
      req.session.pendingOrder = newOrder;
      return res.redirect("/orders/paypal");
    } else {
      // Nếu thanh toán khi nhận hàng (COD)
      newOrder.paymentStatus = "pending";
      newOrder.status = "processing";
      await newOrder.save();

      // Xóa giỏ hàng sau khi đặt hàng thành công
      req.session.cart = [];

      req.flash("success_msg", "Đặt hàng thành công!");
      return res.redirect(`/users/orders/${newOrder._id}`);
    }
  } catch (err) {
    console.error(err);
    req.flash("error_msg", err.message || "Có lỗi xảy ra khi đặt hàng");
    res.redirect("/cart/checkout");
  }
});

// Trang thanh toán qua thẻ
router.get("/payment", (req, res) => {
  // Kiểm tra xem có đơn hàng đang chờ thanh toán không
  if (!req.session.pendingOrder) {
    req.flash("error_msg", "Không có đơn hàng để thanh toán");
    return res.redirect("/cart");
  }

  const order = req.session.pendingOrder;

  res.render("orders/payment", {
    title: "Thanh toán đơn hàng",
    order,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
  });
});

// Xử lý thanh toán qua Stripe
router.post("/process-payment", async (req, res) => {
  try {
    const { stripeToken } = req.body;

    // Kiểm tra xem có đơn hàng đang chờ thanh toán không
    if (!req.session.pendingOrder) {
      req.flash("error_msg", "Không có đơn hàng để thanh toán");
      return res.redirect("/cart");
    }

    const order = req.session.pendingOrder;

    // Tạo charge trong Stripe
    const charge = await stripe.charges.create({
      amount: Math.round(order.totalAmount * 100), // Stripe tính bằng cent
      currency: "vnd",
      source: stripeToken,
      description: `Thanh toán đơn hàng cho ${req.user.email}`,
    });

    // Cập nhật thông tin thanh toán
    order.paymentStatus = "completed";
    order.paymentId = charge.id;
    order.status = "processing";

    // Lưu đơn hàng vào database
    const savedOrder = new Order(order);
    await savedOrder.save();

    // Xóa thông tin đơn hàng đang chờ và giỏ hàng
    delete req.session.pendingOrder;
    req.session.cart = [];

    req.flash("success_msg", "Thanh toán thành công!");
    res.redirect(`/users/orders/${savedOrder._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý thanh toán");
    res.redirect("/orders/payment");
  }
});

// Trang thanh toán qua PayPal
router.get("/paypal", (req, res) => {
  // Kiểm tra xem có đơn hàng đang chờ thanh toán không
  if (!req.session.pendingOrder) {
    req.flash("error_msg", "Không có đơn hàng để thanh toán");
    return res.redirect("/cart");
  }

  const order = req.session.pendingOrder;

  res.render("orders/paypal", {
    title: "Thanh toán qua PayPal",
    order,
  });
});

// Webhook để nhận thông tin thanh toán từ PayPal
router.post("/paypal-webhook", async (req, res) => {
  // TODO: Xử lý webhook từ PayPal
  res.sendStatus(200);
});

// Trang hoàn thành thanh toán PayPal
router.get("/paypal/success", async (req, res) => {
  try {
    // Kiểm tra xem có đơn hàng đang chờ thanh toán không
    if (!req.session.pendingOrder) {
      req.flash("error_msg", "Không có đơn hàng để thanh toán");
      return res.redirect("/cart");
    }

    const order = req.session.pendingOrder;

    // Cập nhật thông tin thanh toán
    order.paymentStatus = "completed";
    order.paymentId = req.query.paymentId;
    order.status = "processing";

    // Lưu đơn hàng vào database
    const savedOrder = new Order(order);
    await savedOrder.save();

    // Xóa thông tin đơn hàng đang chờ và giỏ hàng
    delete req.session.pendingOrder;
    req.session.cart = [];

    req.flash("success_msg", "Thanh toán qua PayPal thành công!");
    res.redirect(`/users/orders/${savedOrder._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xử lý thanh toán");
    res.redirect("/cart");
  }
});

// Hủy thanh toán PayPal
router.get("/paypal/cancel", (req, res) => {
  req.flash("error_msg", "Bạn đã hủy thanh toán qua PayPal");
  res.redirect("/cart/checkout");
});

// Hủy đơn hàng
router.post("/:id/cancel", async (req, res) => {
  try {
    const orderId = req.params.id;

    // Tìm đơn hàng
    const order = await Order.findById(orderId);

    // Kiểm tra quyền
    if (!order || order.user.toString() !== req.user.id) {
      req.flash(
        "error_msg",
        "Không tìm thấy đơn hàng hoặc bạn không có quyền hủy"
      );
      return res.redirect("/users/orders");
    }

    // Kiểm tra trạng thái, chỉ hủy được khi đơn hàng chưa giao
    if (["shipped", "delivered"].includes(order.status)) {
      req.flash("error_msg", "Không thể hủy đơn hàng đã giao hoặc đang giao");
      return res.redirect(`/users/orders/${orderId}`);
    }

    // Cập nhật trạng thái đơn hàng
    order.status = "cancelled";

    // Hoàn lại số lượng sản phẩm vào kho
    await Promise.all(
      order.products.map(async (item) => {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          await product.save();
        }
      })
    );

    await order.save();

    req.flash("success_msg", "Đã hủy đơn hàng thành công");
    res.redirect(`/users/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi hủy đơn hàng");
    res.redirect("/users/orders");
  }
});

module.exports = router;
