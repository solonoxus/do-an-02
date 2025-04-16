const nodemailer = require("nodemailer");

// Tạo transporter để gửi email
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Gửi email đặt lại mật khẩu
const sendPasswordResetEmail = async (email, resetUrl) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Đặt lại mật khẩu",
      html: `
        <h1>Đặt lại mật khẩu</h1>
        <p>Bạn nhận được email này vì bạn (hoặc ai đó) đã yêu cầu đặt lại mật khẩu.</p>
        <p>Vui lòng click vào link dưới đây hoặc dán vào trình duyệt để đặt lại mật khẩu:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>Nếu bạn không yêu cầu điều này, vui lòng bỏ qua email này và mật khẩu của bạn sẽ không thay đổi.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Lỗi gửi email:", err);
    throw new Error("Không thể gửi email đặt lại mật khẩu");
  }
};

// Gửi email xác nhận đơn hàng
const sendOrderConfirmationEmail = async (email, order) => {
  try {
    const productsHtml = order.products
      .map((item) => {
        return `
        <tr>
          <td>${item.name}</td>
          <td>${item.quantity}</td>
          <td>${item.price.toLocaleString("vi-VN")}đ</td>
          <td>${(item.price * item.quantity).toLocaleString("vi-VN")}đ</td>
        </tr>
      `;
      })
      .join("");

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Xác nhận đơn hàng #${order._id}`,
      html: `
        <h1>Cảm ơn bạn đã đặt hàng!</h1>
        <p>Chúng tôi đã nhận được đơn hàng của bạn và đang xử lý.</p>
        
        <h2>Thông tin đơn hàng #${order._id}</h2>
        <p><strong>Ngày đặt hàng:</strong> ${new Date(
          order.createdAt
        ).toLocaleString("vi-VN")}</p>
        <p><strong>Phương thức thanh toán:</strong> ${
          order.paymentMethod === "cod"
            ? "Thanh toán khi nhận hàng"
            : order.paymentMethod === "credit_card"
            ? "Thẻ tín dụng"
            : "PayPal"
        }</p>
        <p><strong>Trạng thái thanh toán:</strong> ${
          order.paymentStatus === "completed"
            ? "Đã thanh toán"
            : "Chưa thanh toán"
        }</p>
        
        <h3>Sản phẩm đã đặt:</h3>
        <table border="1" cellpadding="5" cellspacing="0" style="width: 100%;">
          <tr>
            <th>Sản phẩm</th>
            <th>Số lượng</th>
            <th>Giá</th>
            <th>Tổng</th>
          </tr>
          ${productsHtml}
          <tr>
            <td colspan="3" align="right"><strong>Tổng cộng:</strong></td>
            <td><strong>${order.totalAmount.toLocaleString(
              "vi-VN"
            )}đ</strong></td>
          </tr>
        </table>
        
        <h3>Địa chỉ giao hàng:</h3>
        <p>
          ${order.shippingAddress.name}<br>
          ${order.shippingAddress.phone}<br>
          ${order.shippingAddress.street}<br>
          ${order.shippingAddress.city}, ${order.shippingAddress.state}<br>
          ${order.shippingAddress.zipCode}<br>
          ${order.shippingAddress.country}
        </p>
        
        <p>Cảm ơn bạn đã mua hàng!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Lỗi gửi email:", err);
    // Không gửi được email cũng không sao, chỉ log lỗi
  }
};

// Gửi email cập nhật trạng thái đơn hàng
const sendOrderStatusEmail = async (email, order) => {
  try {
    let statusText = "";

    switch (order.status) {
      case "processing":
        statusText = "đang được xử lý";
        break;
      case "shipped":
        statusText = "đã được giao cho đơn vị vận chuyển";
        break;
      case "delivered":
        statusText = "đã được giao thành công";
        break;
      case "cancelled":
        statusText = "đã bị hủy";
        break;
      default:
        statusText = order.status;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Cập nhật trạng thái đơn hàng #${order._id}`,
      html: `
        <h1>Cập nhật trạng thái đơn hàng</h1>
        <p>Đơn hàng #${order._id} của bạn ${statusText}.</p>
        
        ${
          order.status === "shipped" && order.trackingNumber
            ? `
          <p><strong>Mã vận đơn:</strong> ${order.trackingNumber}</p>
        `
            : ""
        }
        
        <p>Để xem chi tiết đơn hàng, vui lòng đăng nhập vào tài khoản của bạn.</p>
        
        <p>Cảm ơn bạn đã mua hàng!</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Lỗi gửi email:", err);
    // Không gửi được email cũng không sao, chỉ log lỗi
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
};
