const express = require("express");
const router = express.Router();
const { ensureAdmin } = require("../middlewares/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const Order = require("../models/Order");
const OrderHistory = require("../models/OrderHistory");

// Cấu hình multer để upload ảnh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/images/products");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10000000 }, // Tăng giới hạn lên 10MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Chỉ cho phép tải lên các file hình ảnh"));
  },
});

// Middleware upload nhiều field
const uploadFields = upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "images", maxCount: 5 },
]);

// Middleware để đảm bảo người dùng là admin
router.use(ensureAdmin);

// Middleware để chọn layout admin và truyền thông tin path
router.use((req, res, next) => {
  res.locals.layout = "layouts/admin";
  res.locals.path = req.originalUrl;
  next();
});

// Middleware để truyền thông tin người dùng hiện tại cho tất cả các route
router.use((req, res, next) => {
  res.locals.currentUser = req.user;
  next();
});

// Dashboard
router.get("/", ensureAdmin, async (req, res) => {
  try {
    // Đếm tổng số sản phẩm
    const productsCount = await Product.countDocuments();

    // Đếm tổng số đơn hàng
    const ordersCount = await Order.countDocuments();

    // Đếm tổng số người dùng
    const usersCount = await User.countDocuments();

    // Tính tổng doanh thu từ đơn hàng đã hoàn thành và đã thanh toán
    const revenue = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].total : 0;

    // Tính doanh thu trong tháng hiện tại
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59
    );

    const monthlyRevenue = await Order.aggregate([
      {
        $match: {
          status: "delivered",
          paymentStatus: "completed",
          createdAt: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalMonthlyRevenue =
      monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0;

    // Đếm đơn hàng theo trạng thái
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusCounts = {};
    ordersByStatus.forEach((item) => {
      statusCounts[item._id] = item.count;
    });

    res.render("admin/dashboard", {
      title: "Trang quản trị",
      productsCount,
      ordersCount,
      usersCount,
      totalRevenue,
      totalMonthlyRevenue,
      statusCounts,
    });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", {
      message: "Có lỗi xảy ra khi tải dữ liệu",
      error: err,
    });
  }
});

// Thống kê doanh thu
router.get("/revenue", ensureAdmin, async (req, res) => {
  try {
    // Lấy các tham số từ query
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const startMonth = parseInt(req.query.startMonth) || 1;
    const endMonth = parseInt(req.query.endMonth) || 12;

    // Tạo mảng chứa dữ liệu tất cả các tháng
    const monthLabels = [];
    const monthlyData = [];

    // Tạo danh sách các tháng cần thống kê
    for (let month = startMonth; month <= endMonth; month++) {
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);

      // Tính tổng doanh thu trong tháng (chỉ tính đơn hàng đã giao và đã thanh toán)
      const monthlyRevenue = await Order.aggregate([
        {
          $match: {
            status: "delivered",
            paymentStatus: "completed",
            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$totalAmount" },
          },
        },
      ]);

      const monthName = new Date(year, month - 1, 1).toLocaleString("vi-VN", {
        month: "long",
      });
      monthLabels.push(`${monthName} ${year}`);
      monthlyData.push(monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0);
    }

    // Tính tổng doanh thu trong khoảng thời gian đã chọn
    const totalRevenue = monthlyData.reduce((sum, revenue) => sum + revenue, 0);

    // Lấy danh sách năm để hiển thị dropdown
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 5; i--) {
      years.push(i);
    }

    // Lấy top 5 sản phẩm bán chạy nhất
    const topProducts = await Order.aggregate([
      { $match: { status: "delivered", paymentStatus: "completed" } },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.product",
          productName: { $first: "$products.name" },
          totalQuantity: { $sum: "$products.quantity" },
          totalAmount: {
            $sum: { $multiply: ["$products.price", "$products.quantity"] },
          },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    // Phân tích doanh thu theo phương thức thanh toán
    const revenueByPaymentMethod = await Order.aggregate([
      { $match: { status: "delivered", paymentStatus: "completed" } },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const paymentMethodData = {
      labels: [],
      data: [],
    };

    revenueByPaymentMethod.forEach((item) => {
      let methodName = "Không xác định";
      if (item._id === "cod") methodName = "Thanh toán khi nhận hàng";
      else if (item._id === "credit_card") methodName = "Thẻ tín dụng";
      else if (item._id === "paypal") methodName = "PayPal";

      paymentMethodData.labels.push(methodName);
      paymentMethodData.data.push(item.total);
    });

    res.render("admin/revenue", {
      title: "Thống kê doanh thu",
      monthLabels: JSON.stringify(monthLabels),
      monthlyData: JSON.stringify(monthlyData),
      totalRevenue,
      year,
      startMonth,
      endMonth,
      years,
      topProducts,
      paymentMethodData: JSON.stringify(paymentMethodData),
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải dữ liệu thống kê");
    res.redirect("/admin");
  }
});

// QUẢN LÝ SẢN PHẨM

// Danh sách sản phẩm
router.get("/products", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Tìm kiếm theo tên
    let query = {};
    if (req.query.search) {
      query.name = { $regex: req.query.search, $options: "i" };
    }

    // Lọc theo danh mục
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Đếm tổng số sản phẩm
    const total = await Product.countDocuments(query);

    // Lấy danh sách sản phẩm
    const products = await Product.find(query)
      .populate("category")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Lấy danh sách danh mục để hiển thị lọc
    const categories = await Category.find();

    const totalPages = Math.ceil(total / limit);

    res.render("admin/products/index", {
      title: "Quản lý sản phẩm",
      products,
      categories,
      currentPage: page,
      totalPages,
      totalProducts: total,
      query: req.query,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải danh sách sản phẩm");
    res.redirect("/admin");
  }
});

// Form thêm sản phẩm
router.get("/products/add", async (req, res) => {
  try {
    const categories = await Category.find();

    res.render("admin/products/add", {
      title: "Thêm sản phẩm mới",
      categories,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/products");
  }
});

// Xử lý thêm sản phẩm
router.post("/products/add", uploadFields, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      salePrice,
      category,
      stock,
      featured,
      slug,
      specKeys,
      specValues,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !description || !price || !category || !stock || !slug) {
      // Xóa file đã upload nếu có lỗi
      if (req.files) {
        Object.keys(req.files).forEach((fieldname) => {
          req.files[fieldname].forEach((file) => {
            fs.unlinkSync(file.path);
          });
        });
      }

      req.flash("error_msg", "Vui lòng điền đầy đủ thông tin sản phẩm");
      return res.redirect("/admin/products/add");
    }

    // Kiểm tra slug đã tồn tại chưa
    const existingProduct = await Product.findOne({ slug });
    if (existingProduct) {
      // Xóa file đã upload nếu có lỗi
      if (req.files) {
        Object.keys(req.files).forEach((fieldname) => {
          req.files[fieldname].forEach((file) => {
            fs.unlinkSync(file.path);
          });
        });
      }

      req.flash("error_msg", "Slug đã tồn tại, vui lòng chọn slug khác");
      return res.redirect("/admin/products/add");
    }

    // Xử lý ảnh
    let images = [];
    let mainImage = "";

    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      mainImage = req.files.mainImage[0].path.replace("public", "");
    } else {
      req.flash("error_msg", "Vui lòng tải lên ảnh chính của sản phẩm");
      return res.redirect("/admin/products/add");
    }

    // Thêm các ảnh bổ sung nếu có
    if (req.files && req.files.images) {
      images = req.files.images.map((file) => file.path.replace("public", ""));
    }

    // Thêm ảnh chính vào mảng ảnh
    images.unshift(mainImage);

    // Xử lý thông số kỹ thuật
    const specifications = {};
    if (specKeys && specValues) {
      if (Array.isArray(specKeys)) {
        specKeys.forEach((key, index) => {
          if (key && specValues[index]) {
            specifications[key] = specValues[index];
          }
        });
      } else if (specKeys && specValues) {
        specifications[specKeys] = specValues;
      }
    }

    // Tạo sản phẩm mới
    const newProduct = new Product({
      name,
      description,
      price,
      salePrice: salePrice || undefined,
      category,
      stock,
      images,
      mainImage,
      featured: featured === "on",
      slug,
      specifications,
    });

    await newProduct.save();

    req.flash("success_msg", "Đã thêm sản phẩm mới thành công");
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi thêm sản phẩm: " + err.message);
    res.redirect("/admin/products/add");
  }
});

// Form chỉnh sửa sản phẩm
router.get("/products/edit/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("/admin/products");
    }

    const categories = await Category.find();

    res.render("admin/products/edit", {
      title: "Chỉnh sửa sản phẩm",
      product,
      categories,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/products");
  }
});

// Xử lý chỉnh sửa sản phẩm
router.post("/products/edit/:id", uploadFields, async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      salePrice,
      category,
      stock,
      featured,
      slug,
      specKeys,
      specValues,
      removeMainImage,
      removeImages,
    } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !description || !price || !category || !stock || !slug) {
      req.flash("error_msg", "Vui lòng điền đầy đủ thông tin sản phẩm");
      return res.redirect(`/admin/products/edit/${req.params.id}`);
    }

    // Tìm sản phẩm cần chỉnh sửa
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("/admin/products");
    }

    // Kiểm tra slug đã tồn tại với sản phẩm khác chưa
    if (slug !== product.slug) {
      const existingProduct = await Product.findOne({
        slug,
        _id: { $ne: req.params.id },
      });
      if (existingProduct) {
        req.flash("error_msg", "Slug đã tồn tại, vui lòng chọn slug khác");
        return res.redirect(`/admin/products/edit/${req.params.id}`);
      }
    }

    // Xử lý ảnh
    let images = [...product.images]; // Sao chép mảng ảnh hiện tại
    let mainImage = product.mainImage;

    // Xóa ảnh chính nếu được chọn
    if (removeMainImage === "on") {
      const fullPath = path.join(__dirname, "..", "public", mainImage);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      // Cũng xóa khỏi mảng ảnh
      images = images.filter((img) => img !== mainImage);
      mainImage = images.length > 0 ? images[0] : "";
    }

    // Xóa các ảnh phụ đã chọn
    if (removeImages) {
      const imagesToRemove = Array.isArray(removeImages)
        ? removeImages
        : [removeImages];
      imagesToRemove.forEach((index) => {
        const imgIndex = parseInt(index);
        if (!isNaN(imgIndex) && imgIndex >= 0 && imgIndex < images.length) {
          const imgToRemove = images[imgIndex];
          // Không xóa ảnh chính
          if (imgToRemove !== mainImage) {
            const fullPath = path.join(__dirname, "..", "public", imgToRemove);
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
            images.splice(imgIndex, 1);
          }
        }
      });
    }

    // Thêm ảnh chính mới nếu có
    if (req.files && req.files.mainImage && req.files.mainImage.length > 0) {
      // Xóa ảnh chính cũ nếu có
      if (mainImage) {
        const fullPath = path.join(__dirname, "..", "public", mainImage);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        // Cũng xóa khỏi mảng ảnh
        images = images.filter((img) => img !== mainImage);
      }

      const newMainImage = req.files.mainImage[0].path.replace("public", "");
      mainImage = newMainImage;
      // Thêm ảnh chính vào mảng ảnh
      images.unshift(mainImage);
    }

    // Thêm ảnh phụ mới
    if (req.files && req.files.images) {
      const newImages = req.files.images.map((file) =>
        file.path.replace("public", "")
      );
      images = [...images, ...newImages];
    }

    // Kiểm tra phải có ít nhất 1 ảnh
    if (images.length === 0) {
      req.flash("error_msg", "Sản phẩm phải có ít nhất 1 ảnh");
      return res.redirect(`/admin/products/edit/${req.params.id}`);
    }

    // Đảm bảo mainImage được cập nhật
    if (!mainImage && images.length > 0) {
      mainImage = images[0];
    }

    // Xử lý thông số kỹ thuật
    const specifications = {};
    if (specKeys && specValues) {
      if (Array.isArray(specKeys)) {
        specKeys.forEach((key, index) => {
          if (key && specValues[index]) {
            specifications[key] = specValues[index];
          }
        });
      } else if (specKeys && specValues) {
        specifications[specKeys] = specValues;
      }
    }

    // Cập nhật sản phẩm
    product.name = name;
    product.description = description;
    product.price = price;
    product.salePrice = salePrice || undefined;
    product.category = category;
    product.stock = stock;
    product.images = images;
    product.mainImage = mainImage;
    product.featured = featured === "on";
    product.slug = slug;
    product.specifications = specifications;
    product.updatedAt = Date.now();

    await product.save();

    req.flash("success_msg", "Đã cập nhật sản phẩm thành công");
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    req.flash(
      "error_msg",
      "Có lỗi xảy ra khi cập nhật sản phẩm: " + err.message
    );
    res.redirect(`/admin/products/edit/${req.params.id}`);
  }
});

// Xóa sản phẩm
router.delete("/products/delete/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      req.flash("error_msg", "Không tìm thấy sản phẩm");
      return res.redirect("/admin/products");
    }

    // Xóa các file ảnh
    product.images.forEach((img) => {
      const fullPath = path.join(__dirname, "..", "public", img);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });

    // Xóa sản phẩm
    await Product.findByIdAndDelete(req.params.id);

    req.flash("success_msg", "Đã xóa sản phẩm thành công");
    res.redirect("/admin/products");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xóa sản phẩm");
    res.redirect("/admin/products");
  }
});

// QUẢN LÝ DANH MỤC

// Danh sách danh mục
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    res.render("admin/categories/index", {
      title: "Quản lý danh mục",
      categories,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải danh sách danh mục");
    res.redirect("/admin");
  }
});

// Form thêm danh mục
router.get("/categories/add", async (req, res) => {
  try {
    // Lấy danh sách danh mục cha
    const parentCategories = await Category.find();

    res.render("admin/categories/add", {
      title: "Thêm danh mục mới",
      parentCategories,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/categories");
  }
});

// Xử lý thêm danh mục
router.post("/categories/add", upload.single("image"), async (req, res) => {
  try {
    const { name, description, slug, parent, featured } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!name || !slug) {
      // Xóa file nếu có lỗi
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      req.flash("error_msg", "Vui lòng điền tên và slug danh mục");
      return res.redirect("/admin/categories/add");
    }

    // Kiểm tra slug đã tồn tại chưa
    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      // Xóa file nếu có lỗi
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      req.flash("error_msg", "Slug đã tồn tại, vui lòng chọn slug khác");
      return res.redirect("/admin/categories/add");
    }

    // Xử lý ảnh
    let image = "";
    if (req.file) {
      image = req.file.path.replace("public", "");
    }

    // Tạo danh mục mới
    const newCategory = new Category({
      name,
      description,
      slug,
      image,
      parent: parent || null,
      featured: featured === "on",
    });

    await newCategory.save();

    req.flash("success_msg", "Đã thêm danh mục mới thành công");
    res.redirect("/admin/categories");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi thêm danh mục");
    res.redirect("/admin/categories/add");
  }
});

// Form chỉnh sửa danh mục
router.get("/categories/edit/:id", async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      req.flash("error_msg", "Không tìm thấy danh mục");
      return res.redirect("/admin/categories");
    }

    // Lấy danh sách danh mục cha (không bao gồm danh mục hiện tại)
    const parentCategories = await Category.find({
      _id: { $ne: req.params.id },
    });

    res.render("admin/categories/edit", {
      title: "Chỉnh sửa danh mục",
      category,
      parentCategories,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/categories");
  }
});

// Xử lý chỉnh sửa danh mục
router.post(
  "/categories/edit/:id",
  upload.single("image"),
  async (req, res) => {
    try {
      const { name, description, slug, parent, featured, removeImage } =
        req.body;

      // Kiểm tra các trường bắt buộc
      if (!name || !slug) {
        req.flash("error_msg", "Vui lòng điền tên và slug danh mục");
        return res.redirect(`/admin/categories/edit/${req.params.id}`);
      }

      // Tìm danh mục cần chỉnh sửa
      const category = await Category.findById(req.params.id);

      if (!category) {
        req.flash("error_msg", "Không tìm thấy danh mục");
        return res.redirect("/admin/categories");
      }

      // Kiểm tra slug đã tồn tại với danh mục khác chưa
      if (slug !== category.slug) {
        const existingCategory = await Category.findOne({
          slug,
          _id: { $ne: req.params.id },
        });
        if (existingCategory) {
          req.flash("error_msg", "Slug đã tồn tại, vui lòng chọn slug khác");
          return res.redirect(`/admin/categories/edit/${req.params.id}`);
        }
      }

      // Xử lý ảnh
      let image = category.image;

      // Nếu có yêu cầu xóa ảnh
      if (removeImage === "on" && image) {
        const fullPath = path.join(__dirname, "..", "public", image);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
        image = "";
      }

      // Nếu có upload ảnh mới
      if (req.file) {
        // Xóa ảnh cũ nếu có
        if (image) {
          const fullPath = path.join(__dirname, "..", "public", image);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }

        // Cập nhật ảnh mới
        image = req.file.path.replace("public", "");
      }

      // Cập nhật thông tin danh mục
      category.name = name;
      category.description = description;
      category.slug = slug;
      category.image = image;
      category.parent = parent || null;
      category.featured = featured === "on";
      category.updatedAt = Date.now();

      await category.save();

      req.flash("success_msg", "Đã cập nhật danh mục thành công");
      res.redirect("/admin/categories");
    } catch (err) {
      console.error(err);
      req.flash("error_msg", "Có lỗi xảy ra khi cập nhật danh mục");
      res.redirect(`/admin/categories/edit/${req.params.id}`);
    }
  }
);

// Xóa danh mục
router.post("/categories/delete/:id", async (req, res) => {
  try {
    // Kiểm tra xem có sản phẩm nào thuộc danh mục này không
    const productsCount = await Product.countDocuments({
      category: req.params.id,
    });

    if (productsCount > 0) {
      req.flash(
        "error_msg",
        "Không thể xóa danh mục có sản phẩm. Vui lòng xóa các sản phẩm trước."
      );
      return res.redirect("/admin/categories");
    }

    const category = await Category.findById(req.params.id);

    if (!category) {
      req.flash("error_msg", "Không tìm thấy danh mục");
      return res.redirect("/admin/categories");
    }

    // Xóa ảnh nếu có
    if (category.image) {
      const fullPath = path.join(__dirname, "..", "public", category.image);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Xóa danh mục
    await Category.findByIdAndDelete(req.params.id);

    req.flash("success_msg", "Đã xóa danh mục thành công");
    res.redirect("/admin/categories");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xóa danh mục");
    res.redirect("/admin/categories");
  }
});

// QUẢN LÝ ĐƠN HÀNG

// Danh sách đơn hàng
router.get("/orders", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Xây dựng query
    let query = {};

    // Tìm kiếm theo trạng thái
    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    // Tìm kiếm theo mã đơn hàng
    if (req.query.orderId) {
      query._id = { $regex: req.query.orderId, $options: "i" };
    }

    // Tìm kiếm theo người dùng
    if (req.query.user) {
      query.user = req.query.user;
    }

    // Tìm kiếm theo khoảng thời gian
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate + "T23:59:59.999Z"),
      };
    } else if (req.query.startDate) {
      query.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.createdAt = {
        $lte: new Date(req.query.endDate + "T23:59:59.999Z"),
      };
    }

    // Đếm tổng số đơn hàng
    const total = await Order.countDocuments(query);

    // Lấy danh sách đơn hàng
    const orders = await Order.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    // Các trạng thái đơn hàng để hiển thị bộ lọc
    const orderStatuses = [
      "pending",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    // Thống kê nhanh theo trạng thái
    const statusCounts = await Order.aggregate([
      { $match: {} },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusStats = {};
    statusCounts.forEach((item) => {
      statusStats[item._id] = item.count;
    });

    // Tổng doanh thu của các đơn hàng đã hoàn thành
    const revenue = await Order.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    const totalRevenue = revenue.length > 0 ? revenue[0].total : 0;

    res.render("admin/orders/index", {
      title: "Quản lý đơn hàng",
      orders,
      currentPage: page,
      totalPages,
      totalOrders: total,
      query: req.query,
      orderStatuses,
      statusStats,
      totalRevenue,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải danh sách đơn hàng");
    res.redirect("/admin");
  }
});

// Chi tiết đơn hàng
router.get("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email phone address")
      .populate("products.product");

    if (!order) {
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/admin/orders");
    }

    // Lấy lịch sử thay đổi trạng thái đơn hàng (nếu có)
    const orderHistory = await OrderHistory.find({ orderId: order._id }).sort({
      createdAt: -1,
    });

    res.render("admin/orders/detail", {
      title: "Chi tiết đơn hàng",
      order,
      orderHistory,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải thông tin đơn hàng");
    res.redirect("/admin/orders");
  }
});

// Cập nhật trạng thái đơn hàng
router.post("/orders/:id/update-status", async (req, res) => {
  try {
    const { status, notifyCustomer, note } = req.body;
    const orderId = req.params.id;

    if (!status) {
      req.flash("error_msg", "Vui lòng chọn trạng thái");
      return res.redirect(`/admin/orders/${orderId}`);
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId).populate("user", "name email");

    if (!order) {
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/admin/orders");
    }

    const oldStatus = order.status;

    // Trường hợp đặc biệt: nếu trạng thái trước đó là "cancelled" và đang được thay đổi
    // thì cần trừ lại số lượng sản phẩm trong kho (vì đã hoàn lại khi hủy)
    if (oldStatus === "cancelled" && status !== "cancelled") {
      await Promise.all(
        order.products.map(async (item) => {
          const product = await Product.findById(item.product);
          if (product) {
            product.stock = Math.max(0, product.stock - item.quantity);
            await product.save();
          }
        })
      );
    }
    // Trường hợp đang chuyển sang trạng thái hủy đơn
    else if (status === "cancelled" && oldStatus !== "cancelled") {
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
    }

    // Cập nhật trạng thái đơn hàng
    order.status = status;
    order.updatedAt = Date.now();

    // Lưu ghi chú vào đơn hàng nếu có
    if (note) {
      order.notes = order.notes || [];
      order.notes.push({
        content: note,
        createdBy: req.user.name,
        createdAt: new Date(),
      });
    }

    await order.save();

    // Lưu lịch sử thay đổi trạng thái
    const orderHistory = new OrderHistory({
      orderId: order._id,
      prevStatus: oldStatus,
      newStatus: status,
      updatedBy: req.user._id,
      note: note || `Cập nhật trạng thái từ ${oldStatus} thành ${status}`,
    });
    await orderHistory.save();

    // Gửi email thông báo cho khách hàng nếu được chọn
    if (notifyCustomer === "on" && order.user && order.user.email) {
      // Chuẩn bị nội dung email
      const statusVietnamese = {
        pending: "Chờ xác nhận",
        processing: "Đang xử lý",
        shipped: "Đang giao hàng",
        delivered: "Đã giao hàng",
        cancelled: "Đã hủy",
      };

      const emailSubject = `Cập nhật trạng thái đơn hàng #${order._id
        .toString()
        .substring(0, 8)}`;
      const emailContent = `
        <h2>Xin chào ${order.user.name},</h2>
        <p>Đơn hàng #${order._id
          .toString()
          .substring(0, 8)} của bạn đã được cập nhật sang trạng thái: <strong>${
        statusVietnamese[status]
      }</strong>.</p>
        ${note ? `<p>Ghi chú: ${note}</p>` : ""}
        <p>Bạn có thể xem chi tiết đơn hàng <a href="${
          req.protocol
        }://${req.get("host")}/users/orders/${order._id}">tại đây</a>.</p>
        <p>Cảm ơn bạn đã mua sắm tại cửa hàng chúng tôi!</p>
      `;

      // Sử dụng service email để gửi
      try {
        // Gửi email thông báo (commented out thực thi)
        // await emailService.sendEmail(order.user.email, emailSubject, emailContent);
        console.log(`Email notification would be sent to ${order.user.email}`);
      } catch (emailErr) {
        console.error("Lỗi khi gửi email thông báo:", emailErr);
      }
    }

    req.flash("success_msg", "Đã cập nhật trạng thái đơn hàng thành công");
    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật trạng thái đơn hàng");
    res.redirect(`/admin/orders/${req.params.id}`);
  }
});

// Thêm ghi chú cho đơn hàng
router.post("/orders/:id/add-note", async (req, res) => {
  try {
    const { note } = req.body;
    const orderId = req.params.id;

    if (!note) {
      req.flash("error_msg", "Vui lòng nhập ghi chú");
      return res.redirect(`/admin/orders/${orderId}`);
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/admin/orders");
    }

    // Thêm ghi chú mới
    order.notes = order.notes || [];
    order.notes.push({
      content: note,
      createdBy: req.user.name,
      createdAt: new Date(),
    });

    await order.save();

    req.flash("success_msg", "Đã thêm ghi chú cho đơn hàng");
    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi thêm ghi chú");
    res.redirect(`/admin/orders/${req.params.id}`);
  }
});

// Xuất báo cáo đơn hàng
router.get("/orders/export/report", async (req, res) => {
  try {
    // Xử lý query tương tự như route danh sách đơn hàng
    let query = {};

    // Tìm kiếm theo trạng thái
    if (req.query.status && req.query.status !== "all") {
      query.status = req.query.status;
    }

    // Tìm kiếm theo khoảng thời gian
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate + "T23:59:59.999Z"),
      };
    } else if (req.query.startDate) {
      query.createdAt = { $gte: new Date(req.query.startDate) };
    } else if (req.query.endDate) {
      query.createdAt = {
        $lte: new Date(req.query.endDate + "T23:59:59.999Z"),
      };
    }

    // Lấy danh sách đơn hàng
    const orders = await Order.find(query)
      .populate("user", "name email phone")
      .sort({ createdAt: -1 });

    if (orders.length === 0) {
      req.flash("error_msg", "Không có dữ liệu đơn hàng để xuất báo cáo");
      return res.redirect("/admin/orders");
    }

    // Chuẩn bị dữ liệu cho file CSV
    const csvRows = [];
    const headers = [
      "ID Đơn hàng",
      "Ngày đặt",
      "Khách hàng",
      "Email",
      "Số điện thoại",
      "Địa chỉ giao hàng",
      "Sản phẩm",
      "Tổng tiền",
      "Trạng thái",
      "Phương thức thanh toán",
    ];
    csvRows.push(headers);

    // Chuyển đổi trạng thái sang tiếng Việt
    const statusText = {
      pending: "Chờ xác nhận",
      processing: "Đang xử lý",
      shipped: "Đang giao hàng",
      delivered: "Đã giao hàng",
      cancelled: "Đã hủy",
    };

    // Chuyển đổi phương thức thanh toán
    const paymentText = {
      cod: "Thanh toán khi nhận hàng",
      online: "Thanh toán online",
    };

    orders.forEach((order) => {
      const row = [
        order._id.toString(),
        new Date(order.createdAt).toLocaleString("vi-VN"),
        order.user ? order.user.name : "Không xác định",
        order.user ? order.user.email : "Không xác định",
        order.shippingPhone ||
          (order.user ? order.user.phone : "Không xác định"),
        order.shippingAddress || "Không xác định",
        order.products.map((p) => `${p.name} (${p.quantity})`).join(", "),
        order.totalAmount.toLocaleString("vi-VN"),
        statusText[order.status] || order.status,
        paymentText[order.paymentMethod] || order.paymentMethod,
      ];
      csvRows.push(row);
    });

    // Chuyển đổi mảng thành chuỗi CSV
    let csvString = "";
    csvRows.forEach((row) => {
      csvString += row.map((value) => `"${value}"`).join(",") + "\n";
    });

    // Đặt tên file theo ngày
    const date = new Date();
    const filename = `orders_report_${date.getFullYear()}-${
      date.getMonth() + 1
    }-${date.getDate()}.csv`;

    // Thiết lập header cho response
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);

    // Trả về file CSV
    res.send("\uFEFF" + csvString); // Thêm BOM để Excel nhận dạng UTF-8
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xuất báo cáo đơn hàng");
    res.redirect("/admin/orders");
  }
});

// Cập nhật trạng thái thanh toán đơn hàng
router.post("/orders/:id/update-payment", async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const orderId = req.params.id;

    if (!paymentStatus) {
      req.flash("error_msg", "Vui lòng chọn trạng thái thanh toán");
      return res.redirect(`/admin/orders/${orderId}`);
    }

    // Tìm đơn hàng
    const order = await Order.findById(orderId);

    if (!order) {
      req.flash("error_msg", "Không tìm thấy đơn hàng");
      return res.redirect("/admin/orders");
    }

    // Cập nhật trạng thái thanh toán
    order.paymentStatus = paymentStatus;
    order.updatedAt = Date.now();

    if (paymentStatus === "completed") {
      // Nếu đánh dấu là đã thanh toán, lưu lại thời gian thanh toán
      order.paidAt = Date.now();
    }

    await order.save();

    // Lưu lịch sử thay đổi trạng thái thanh toán
    const orderHistory = new OrderHistory({
      orderId: order._id,
      prevStatus: order.status,
      newStatus: order.status,
      prevPaymentStatus:
        order.paymentStatus !== paymentStatus ? order.paymentStatus : undefined,
      newPaymentStatus: paymentStatus,
      updatedBy: req.user._id,
      note: `Cập nhật trạng thái thanh toán thành ${
        paymentStatus === "completed" ? "Đã thanh toán" : "Chưa thanh toán"
      }`,
    });
    await orderHistory.save();

    req.flash("success_msg", "Đã cập nhật trạng thái thanh toán thành công");
    res.redirect(`/admin/orders/${orderId}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật trạng thái thanh toán");
    res.redirect(`/admin/orders/${req.params.id}`);
  }
});

// QUẢN LÝ NGƯỜI DÙNG

// Danh sách người dùng
router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Tìm kiếm theo email hoặc tên
    let query = {};
    if (req.query.search) {
      query.$or = [
        { name: { $regex: req.query.search, $options: "i" } },
        { email: { $regex: req.query.search, $options: "i" } },
      ];
    }

    // Lọc theo vai trò
    if (req.query.role && req.query.role !== "all") {
      query.role = req.query.role;
    }

    // Đếm tổng số người dùng
    const total = await User.countDocuments(query);

    // Lấy danh sách người dùng
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);

    // Lấy danh sách vai trò để hiển thị bộ lọc
    const roles = ["user", "staff", "manager", "admin", "superadmin"];

    res.render("admin/users/index", {
      title: "Quản lý người dùng",
      users,
      currentPage: page,
      totalPages,
      totalUsers: total,
      query: req.query,
      roles,
      currentUser: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải danh sách người dùng");
    res.redirect("/admin");
  }
});

// Form thêm người dùng mới
router.get("/users/add", async (req, res) => {
  try {
    // Kiểm tra quyền - chỉ superadmin và admin mới có thể thêm người dùng mới
    if (!req.user.isAdmin) {
      req.flash("error_msg", "Bạn không có quyền thực hiện hành động này");
      return res.redirect("/admin/users");
    }

    const roles = ["user", "staff", "manager"];

    // Admin có thể thêm admin khác, nhưng chỉ superadmin mới có thể tạo superadmin
    if (req.user.isSuperAdmin) {
      roles.push("admin", "superadmin");
    } else if (req.user.isAdmin) {
      roles.push("admin");
    }

    res.render("admin/users/add", {
      title: "Thêm người dùng mới",
      roles,
      currentUser: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/users");
  }
});

// Xử lý thêm người dùng mới
router.post("/users/add", async (req, res) => {
  try {
    // Kiểm tra quyền
    if (!req.user.isAdmin) {
      req.flash("error_msg", "Bạn không có quyền thực hiện hành động này");
      return res.redirect("/admin/users");
    }

    const { name, email, password, confirmPassword, phone, role } = req.body;
    const errors = [];

    // Kiểm tra các trường bắt buộc
    if (!name || !email || !password || !confirmPassword) {
      errors.push({ msg: "Vui lòng điền đầy đủ thông tin bắt buộc" });
    }

    // Kiểm tra mật khẩu
    if (password !== confirmPassword) {
      errors.push({ msg: "Mật khẩu xác nhận không khớp" });
    }

    if (password && password.length < 6) {
      errors.push({ msg: "Mật khẩu phải có ít nhất 6 ký tự" });
    }

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errors.push({ msg: "Email đã được sử dụng" });
    }

    // Kiểm tra role hợp lệ
    const validRoles = ["user", "staff", "manager", "admin", "superadmin"];
    if (!validRoles.includes(role)) {
      errors.push({ msg: "Vai trò không hợp lệ" });
    }

    // Kiểm tra quyền tạo superadmin
    if (role === "superadmin" && !req.user.isSuperAdmin) {
      errors.push({ msg: "Bạn không có quyền tạo tài khoản Super Admin" });
    }

    // Kiểm tra quyền tạo admin
    if (role === "admin" && !req.user.isAdmin) {
      errors.push({ msg: "Bạn không có quyền tạo tài khoản Admin" });
    }

    if (errors.length > 0) {
      // Hiển thị form thêm với thông báo lỗi
      const roles = ["user", "staff", "manager"];
      if (req.user.isSuperAdmin) {
        roles.push("admin", "superadmin");
      } else if (req.user.isAdmin) {
        roles.push("admin");
      }

      return res.render("admin/users/add", {
        title: "Thêm người dùng mới",
        errors,
        name,
        email,
        phone,
        role,
        roles,
        currentUser: req.user,
      });
    }

    // Mã hóa mật khẩu
    const bcrypt = require("bcryptjs");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Tạo user mới
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
    });

    await newUser.save();

    req.flash("success_msg", "Đã tạo người dùng mới thành công");
    res.redirect("/admin/users");
  } catch (err) {
    console.error(err);
    req.flash(
      "error_msg",
      "Có lỗi xảy ra khi tạo người dùng mới: " + err.message
    );
    res.redirect("/admin/users/add");
  }
});

// Chi tiết người dùng
router.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Tìm các đơn hàng của người dùng
    const orders = await Order.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .limit(5);

    res.render("admin/users/detail", {
      title: "Thông tin người dùng",
      user,
      orders,
      currentUser: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi tải thông tin người dùng");
    res.redirect("/admin/users");
  }
});

// Form chỉnh sửa người dùng
router.get("/users/edit/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Kiểm tra quyền chỉnh sửa
    if (!req.user.isAdmin && req.user.id !== user._id.toString()) {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa người dùng này");
      return res.redirect("/admin/users");
    }

    // Superadmin có thể chỉnh sửa tất cả
    // Admin chỉ có thể chỉnh sửa người dùng cấp thấp hơn
    if (req.user.role !== "superadmin" && user.role === "superadmin") {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa Super Admin");
      return res.redirect("/admin/users");
    }

    if (
      req.user.role === "admin" &&
      user.role === "admin" &&
      req.user.id !== user._id.toString()
    ) {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa Admin khác");
      return res.redirect("/admin/users");
    }

    // Danh sách các vai trò mà người dùng hiện tại có thể gán
    let roles = ["user", "staff", "manager"];
    if (req.user.isSuperAdmin) {
      roles.push("admin", "superadmin");
    } else if (req.user.isAdmin) {
      roles.push("admin");
    }

    res.render("admin/users/edit", {
      title: "Chỉnh sửa người dùng",
      user,
      roles,
      currentUser: req.user,
    });
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra");
    res.redirect("/admin/users");
  }
});

// Xử lý chỉnh sửa người dùng
router.post("/users/edit/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Kiểm tra quyền chỉnh sửa
    if (!req.user.isAdmin && req.user.id !== user._id.toString()) {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa người dùng này");
      return res.redirect("/admin/users");
    }

    // Superadmin có thể chỉnh sửa tất cả
    // Admin chỉ có thể chỉnh sửa người dùng cấp thấp hơn
    if (req.user.role !== "superadmin" && user.role === "superadmin") {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa Super Admin");
      return res.redirect("/admin/users");
    }

    if (
      req.user.role === "admin" &&
      user.role === "admin" &&
      req.user.id !== user._id.toString()
    ) {
      req.flash("error_msg", "Bạn không có quyền chỉnh sửa Admin khác");
      return res.redirect("/admin/users");
    }

    const {
      name,
      email,
      phone,
      role,
      password,
      confirmPassword,
      street,
      city,
      state,
      zipCode,
      country,
    } = req.body;

    // Kiểm tra email thay đổi đã tồn tại chưa
    if (email !== user.email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: req.params.id },
      });
      if (existingUser) {
        req.flash("error_msg", "Email đã được sử dụng bởi người dùng khác");
        return res.redirect(`/admin/users/edit/${req.params.id}`);
      }
    }

    // Cập nhật mật khẩu nếu có thay đổi
    if (password) {
      if (password.length < 6) {
        req.flash("error_msg", "Mật khẩu phải có ít nhất 6 ký tự");
        return res.redirect(`/admin/users/edit/${req.params.id}`);
      }

      if (password !== confirmPassword) {
        req.flash("error_msg", "Mật khẩu xác nhận không khớp");
        return res.redirect(`/admin/users/edit/${req.params.id}`);
      }

      // Mã hóa mật khẩu mới
      const bcrypt = require("bcryptjs");
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // Cập nhật thông tin người dùng
    user.name = name;
    user.email = email;
    user.phone = phone;

    // Cập nhật địa chỉ
    user.address = {
      street: street || "",
      city: city || "",
      state: state || "",
      zipCode: zipCode || "",
      country: country || "",
    };

    // Chỉ admin và superadmin mới có thể thay đổi vai trò
    if (req.user.isAdmin) {
      // Kiểm tra quyền thay đổi role
      if (role !== user.role) {
        if (role === "superadmin" && !req.user.isSuperAdmin) {
          req.flash("error_msg", "Bạn không có quyền cấp quyền Super Admin");
          return res.redirect(`/admin/users/edit/${req.params.id}`);
        }

        if (role === "admin" && !req.user.isAdmin) {
          req.flash("error_msg", "Bạn không có quyền cấp quyền Admin");
          return res.redirect(`/admin/users/edit/${req.params.id}`);
        }
      }

      user.role = role;
    }

    user.updatedAt = Date.now();

    await user.save();

    req.flash("success_msg", "Đã cập nhật thông tin người dùng thành công");
    res.redirect(`/admin/users/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash(
      "error_msg",
      "Có lỗi xảy ra khi cập nhật thông tin người dùng: " + err.message
    );
    res.redirect(`/admin/users/edit/${req.params.id}`);
  }
});

// Cập nhật trạng thái người dùng (kích hoạt/vô hiệu hóa)
router.post("/users/:id/toggle-status", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Kiểm tra quyền - chỉ admin và superadmin mới có thể thay đổi trạng thái người dùng
    if (!req.user.isAdmin) {
      req.flash("error_msg", "Bạn không có quyền thực hiện hành động này");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Superadmin có thể thay đổi trạng thái tất cả ngoại trừ chính mình
    // Admin chỉ có thể thay đổi trạng thái người dùng cấp thấp hơn
    if (req.user.role !== "superadmin" && user.role === "superadmin") {
      req.flash(
        "error_msg",
        "Bạn không có quyền thay đổi trạng thái Super Admin"
      );
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    if (
      req.user.role === "admin" &&
      user.role === "admin" &&
      req.user.id !== user._id.toString()
    ) {
      req.flash(
        "error_msg",
        "Bạn không có quyền thay đổi trạng thái Admin khác"
      );
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Không thể vô hiệu hóa chính mình
    if (user._id.toString() === req.user.id) {
      req.flash(
        "error_msg",
        "Bạn không thể vô hiệu hóa tài khoản của chính mình"
      );
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Đảo ngược trạng thái
    user.isActive = !user.isActive;
    await user.save();

    req.flash(
      "success_msg",
      `Đã ${user.isActive ? "kích hoạt" : "vô hiệu hóa"} tài khoản thành công`
    );
    res.redirect(`/admin/users/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật trạng thái người dùng");
    res.redirect(`/admin/users/${req.params.id}`);
  }
});

// Cập nhật quyền vai trò người dùng
router.post("/users/:id/update-role", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    const { role } = req.body;

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Kiểm tra quyền - chỉ admin và superadmin mới có thể thay đổi vai trò
    if (!req.user.isAdmin) {
      req.flash("error_msg", "Bạn không có quyền thực hiện hành động này");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Không thể thay đổi vai trò của chính mình
    if (user._id.toString() === req.user.id) {
      req.flash("error_msg", "Bạn không thể thay đổi vai trò của chính mình");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Kiểm tra quyền thay đổi vai trò
    if (role === "superadmin" && !req.user.isSuperAdmin) {
      req.flash("error_msg", "Bạn không có quyền cấp quyền Super Admin");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    if (
      (role === "admin" || user.role === "superadmin") &&
      !req.user.isSuperAdmin
    ) {
      req.flash("error_msg", "Bạn không có quyền thay đổi vai trò này");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Cập nhật vai trò
    user.role = role;
    await user.save();

    req.flash("success_msg", `Đã cập nhật vai trò người dùng thành ${role}`);
    res.redirect(`/admin/users/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi cập nhật vai trò người dùng");
    res.redirect(`/admin/users/${req.params.id}`);
  }
});

// Xóa người dùng
router.delete("/users/delete/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      req.flash("error_msg", "Không tìm thấy người dùng");
      return res.redirect("/admin/users");
    }

    // Kiểm tra quyền - chỉ superadmin mới có thể xóa người dùng
    if (!req.user.isSuperAdmin) {
      req.flash("error_msg", "Bạn không có quyền xóa người dùng");
      return res.redirect("/admin/users");
    }

    // Không thể xóa chính mình
    if (user._id.toString() === req.user.id) {
      req.flash("error_msg", "Bạn không thể xóa tài khoản của chính mình");
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Kiểm tra người dùng có đơn hàng không
    const orderCount = await Order.countDocuments({ user: req.params.id });
    if (orderCount > 0) {
      req.flash(
        "error_msg",
        "Không thể xóa người dùng có đơn hàng. Vui lòng vô hiệu hóa tài khoản thay vì xóa."
      );
      return res.redirect(`/admin/users/${req.params.id}`);
    }

    // Xóa avatar nếu có
    if (user.avatar) {
      const fullPath = path.join(__dirname, "..", "public", user.avatar);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Xóa người dùng
    await User.findByIdAndDelete(req.params.id);

    req.flash("success_msg", "Đã xóa người dùng thành công");
    res.redirect("/admin/users");
  } catch (err) {
    console.error(err);
    req.flash("error_msg", "Có lỗi xảy ra khi xóa người dùng");
    res.redirect("/admin/users");
  }
});

module.exports = router;
