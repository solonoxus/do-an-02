const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

// Đường dẫn thư mục lưu ảnh
const imagesDir = path.join(__dirname, "../public/images");

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Hàm tải hình ảnh từ URL
async function downloadImage(url, filepath) {
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
    });

    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(filepath);
      response.data.pipe(writer);

      writer.on("finish", resolve);
      writer.on("error", reject);
    });
  } catch (error) {
    console.error(`Lỗi tải ảnh từ ${url}:`, error.message);
    throw error;
  }
}

// Danh sách URL hình ảnh cần tải
const imagesToDownload = {
  // Banner chính và banner quảng cáo
  "hero-banner.jpg":
    "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da",
  "promo-banner.jpg":
    "https://images.unsplash.com/photo-1607082349566-187342175e2f",

  // Icon và logo
  "logo.png":
    "https://st3.depositphotos.com/1001599/19250/i/450/depositphotos_192508652-stock-photo-shop-logo-design-template-creative.jpg",
  "favicon.ico": "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",

  // Payment icons
  "payment-visa.png": "https://cdn-icons-png.flaticon.com/512/349/349221.png",
  "payment-mastercard.png":
    "https://cdn-icons-png.flaticon.com/512/349/349228.png",
  "payment-paypal.png": "https://cdn-icons-png.flaticon.com/512/174/174861.png",
  "payment-momo.png":
    "https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png",

  // Social media icons
  "social-facebook.png":
    "https://cdn-icons-png.flaticon.com/512/174/174848.png",
  "social-instagram.png":
    "https://cdn-icons-png.flaticon.com/512/174/174855.png",
  "social-twitter.png":
    "https://cdn-icons-png.flaticon.com/512/3670/3670151.png",
  "social-youtube.png": "https://cdn-icons-png.flaticon.com/512/174/174883.png",

  // Service icons
  "icon-shipping.png":
    "https://cdn-icons-png.flaticon.com/512/8872/8872133.png",
  "icon-support.png": "https://cdn-icons-png.flaticon.com/512/4233/4233839.png",
  "icon-warranty.png":
    "https://cdn-icons-png.flaticon.com/512/2666/2666505.png",
  "icon-payment.png": "https://cdn-icons-png.flaticon.com/512/2331/2331941.png",

  // PayPal logo cho trang thanh toán
  "paypal-logo.png": "https://cdn-icons-png.flaticon.com/512/174/174861.png",
};

// Hàm chính để tải tất cả các hình ảnh
async function downloadAllImages() {
  console.log("Bắt đầu tải hình ảnh banner và icon...");

  try {
    // Tạo danh sách công việc tải hình ảnh
    const downloadTasks = [];

    // Tải từng hình ảnh
    for (const [filename, url] of Object.entries(imagesToDownload)) {
      const imagePath = path.join(imagesDir, filename);
      downloadTasks.push(
        downloadImage(url, imagePath)
          .then(() => console.log(`Đã tải hình ảnh ${filename}`))
          .catch((err) =>
            console.error(`Lỗi khi tải ${filename}:`, err.message)
          )
      );
    }

    // Chờ tất cả các tác vụ tải hoàn thành
    await Promise.all(downloadTasks);

    console.log("Tải hình ảnh banner và icon hoàn tất!");
  } catch (error) {
    console.error("Lỗi khi tải hình ảnh:", error);
  }
}

// Chạy script
downloadAllImages();
