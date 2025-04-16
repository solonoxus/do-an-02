const nodemailer = require("nodemailer");
require("dotenv").config();

// Cấu hình transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Gửi email thông báo khi trạng thái đơn hàng thay đổi
const sendOrderStatusEmail = async (order, newStatus) => {
  try {
    // Lấy thông tin đơn hàng và người dùng
    const { user, orderNumber, items, totalAmount } = order;
    const { email, firstName, lastName } = user;

    // Tạo nội dung dựa trên trạng thái mới
    let subject = "";
    let statusText = "";

    switch (newStatus) {
      case "processing":
        subject = "Đơn hàng của bạn đang được xử lý";
        statusText = "đang được xử lý";
        break;
      case "shipped":
        subject = "Đơn hàng của bạn đã được gửi đi";
        statusText = "đã được gửi đi";
        break;
      case "delivered":
        subject = "Đơn hàng của bạn đã được giao thành công";
        statusText = "đã được giao thành công";
        break;
      case "cancelled":
        subject = "Đơn hàng của bạn đã bị hủy";
        statusText = "đã bị hủy";
        break;
      default:
        subject = "Cập nhật trạng thái đơn hàng";
        statusText = "đã được cập nhật";
    }

    // Tạo danh sách sản phẩm
    const itemsList = items
      .map(
        (item) =>
          `<li>${item.product.name} - Số lượng: ${
            item.quantity
          } - Giá: ${item.price.toLocaleString("vi-VN")}đ</li>`
      )
      .join("");

    // Tạo HTML email
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
        <h2 style="color: #333;">Xin chào ${firstName} ${lastName},</h2>
        <p>Đơn hàng <strong>#${orderNumber}</strong> của bạn hiện ${statusText}.</p>
        
        <h3 style="margin-top: 20px;">Chi tiết đơn hàng:</h3>
        <ul>
          ${itemsList}
        </ul>
        
        <p><strong>Tổng tiền:</strong> ${totalAmount.toLocaleString(
          "vi-VN"
        )}đ</p>
        
        <p style="margin-top: 30px;">Bạn có thể theo dõi đơn hàng trong trang tài khoản của mình.</p>
        
        <p style="margin-top: 30px;">Cảm ơn bạn đã mua sắm cùng chúng tôi!</p>
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #777; font-size: 12px;">
          <p>Đây là email tự động, vui lòng không trả lời email này.</p>
          <p>© ${new Date().getFullYear()} Shop của chúng tôi. Tất cả các quyền được bảo lưu.</p>
        </div>
      </div>
    `;

    // Gửi email
    const info = await transporter.sendMail({
      from: `"Shop của chúng tôi" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: html,
    });

    console.log(`Email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error("Error sending order status email:", error);
    throw error;
  }
};

module.exports = {
  sendOrderStatusEmail,
};
