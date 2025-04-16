module.exports = {
  // Đảm bảo user đã đăng nhập
  ensureAuthenticated: function (req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash("error_msg", "Vui lòng đăng nhập để truy cập trang này");
    res.redirect("/users/login");
  },

  // Chuyển hướng nếu đã đăng nhập
  forwardAuthenticated: function (req, res, next) {
    if (!req.isAuthenticated()) {
      return next();
    }
    res.redirect("/");
  },

  // Kiểm tra quyền admin
  ensureAdmin: function (req, res, next) {
    if (
      req.isAuthenticated() &&
      (req.user.role === "admin" || req.user.role === "superadmin")
    ) {
      return next();
    }
    req.flash("error_msg", "Bạn không có quyền truy cập trang này");
    res.redirect("/");
  },

  // Lưu URL trước đó để sau khi đăng nhập sẽ chuyển hướng về
  saveReturnTo: function (req, res, next) {
    if (req.method === "GET" && !req.path.startsWith("/users/")) {
      req.session.returnTo = req.originalUrl;
    }
    next();
  },
};
