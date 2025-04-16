require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const { faker } = require("@faker-js/faker/locale/vi");

// Tạo mật khẩu mặc định
const createHashedPassword = async () => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash("123456", salt);
};

// Danh sách status đơn hàng
const orderStatuses = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];
const paymentMethods = ["cod", "credit_card", "paypal"];
const paymentStatuses = ["pending", "completed", "failed"];

// Thêm 50 người dùng và mỗi người dùng có 3 đơn hàng
const seedData = async () => {
  try {
    // Kết nối đến database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Đã kết nối với MongoDB");

    // Lấy danh sách sản phẩm từ database
    const products = await Product.find();

    if (products.length === 0) {
      console.log(
        "Không có sản phẩm nào trong database. Vui lòng thêm sản phẩm trước."
      );
      return;
    }

    console.log(`Tìm thấy ${products.length} sản phẩm để sử dụng cho đơn hàng`);

    // Tạo mật khẩu chung cho tất cả người dùng
    const hashedPassword = await createHashedPassword();

    // Tạo 50 người dùng
    const users = [];

    for (let i = 0; i < 50; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const name = `${firstName} ${lastName}`;

      const user = new User({
        name,
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        password: hashedPassword,
        phone: faker.phone.number("0#########"),
        address: {
          street: faker.location.streetAddress(),
          city: faker.location.city(),
          state: faker.location.state(),
          zipCode: faker.location.zipCode(),
          country: "Việt Nam",
        },
        role: "user",
        isActive: true,
        createdAt: faker.date.past({ years: 1 }),
      });

      await user.save();
      users.push(user);

      console.log(`Đã tạo người dùng ${i + 1}/50: ${name}`);
    }

    console.log("Đã tạo xong 50 người dùng");

    // Tạo 3 đơn hàng cho mỗi người dùng
    let orderCount = 0;

    for (const user of users) {
      for (let i = 0; i < 3; i++) {
        // Chọn ngẫu nhiên 1-5 sản phẩm cho đơn hàng
        const numProducts = Math.floor(Math.random() * 5) + 1;
        const orderProducts = [];
        let totalAmount = 0;

        // Tránh trùng lặp sản phẩm trong đơn hàng
        const selectedProductIds = new Set();

        for (let j = 0; j < numProducts; j++) {
          let randomProduct;

          // Chọn sản phẩm không trùng lặp
          do {
            randomProduct =
              products[Math.floor(Math.random() * products.length)];
          } while (selectedProductIds.has(randomProduct._id.toString()));

          selectedProductIds.add(randomProduct._id.toString());

          const quantity = Math.floor(Math.random() * 3) + 1;
          const price =
            randomProduct.salePrice &&
            randomProduct.salePrice < randomProduct.price
              ? randomProduct.salePrice
              : randomProduct.price;

          orderProducts.push({
            product: randomProduct._id,
            name: randomProduct.name,
            price,
            quantity,
          });

          totalAmount += price * quantity;
        }

        // Thêm phí vận chuyển ngẫu nhiên
        const shippingFee = Math.floor(Math.random() * 5) * 10000;
        totalAmount += shippingFee;

        // Trạng thái đơn hàng ngẫu nhiên
        const status =
          orderStatuses[Math.floor(Math.random() * orderStatuses.length)];

        // Phương thức thanh toán ngẫu nhiên
        const paymentMethod =
          paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

        // Tránh trạng thái không hợp lệ
        let paymentStatus = "pending";
        if (status === "delivered") {
          // Đơn hàng đã giao thường đã thanh toán hoặc đã hủy
          paymentStatus = Math.random() > 0.1 ? "completed" : "failed";
        } else if (status === "cancelled") {
          // Đơn hàng hủy thường chưa thanh toán hoặc đã hoàn tiền
          paymentStatus = Math.random() > 0.7 ? "failed" : "pending";
        } else {
          // Các trạng thái khác có thể đã thanh toán hoặc chưa
          paymentStatus = Math.random() > 0.5 ? "completed" : "pending";
        }

        // Ngày đặt hàng ngẫu nhiên trong 6 tháng gần đây
        const orderDate = faker.date.between({
          from: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 ngày trước
          to: new Date(),
        });

        // Ngày thanh toán nếu đã thanh toán
        const paidAt =
          paymentStatus === "completed"
            ? new Date(
                orderDate.getTime() +
                  Math.floor(Math.random() * 48) * 60 * 60 * 1000
              ) // 0-48h sau khi đặt hàng
            : undefined;

        const order = new Order({
          user: user._id,
          products: orderProducts,
          totalAmount,
          shippingFee,
          shippingAddress: {
            name: user.name,
            phone: user.phone,
            street: user.address.street,
            city: user.address.city,
            state: user.address.state,
            zipCode: user.address.zipCode,
            country: user.address.country,
          },
          paymentMethod,
          paymentStatus,
          paidAt,
          status,
          notes: Math.random() > 0.7 ? faker.lorem.sentence() : "",
          createdAt: orderDate,
          updatedAt: new Date(
            orderDate.getTime() +
              Math.floor(Math.random() * 72) * 60 * 60 * 1000
          ), // 0-72h sau khi đặt hàng
        });

        await order.save();
        orderCount++;

        if (orderCount % 10 === 0) {
          console.log(`Đã tạo ${orderCount} đơn hàng`);
        }
      }
    }

    console.log(
      `Hoàn thành! Đã tạo ${users.length} người dùng và ${orderCount} đơn hàng.`
    );
  } catch (error) {
    console.error("Lỗi khi tạo dữ liệu:", error);
  } finally {
    mongoose.disconnect();
    console.log("Đã ngắt kết nối với MongoDB");
  }
};

seedData();
