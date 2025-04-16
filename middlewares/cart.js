module.exports = {
  // Khởi tạo giỏ hàng
  initCart: function (req, res, next) {
    if (!req.session.cart) {
      req.session.cart = [];
    }
    next();
  },

  // Tính toán tổng số lượng và tổng tiền
  calculateCart: function (req, res, next) {
    let cart = req.session.cart || [];
    let totalItems = 0;
    let totalAmount = 0;

    cart.forEach((item) => {
      totalItems += item.quantity;
      totalAmount += item.price * item.quantity;
    });

    // Thêm vào res.locals để có thể dùng ở views
    res.locals.cartTotalItems = totalItems;
    res.locals.cartTotalAmount = totalAmount;
    res.locals.cartItems = cart;

    next();
  },
};
