const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
require("dotenv").config();

// Kết nối MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/ecommerce")
  .then(() => console.log("Đã kết nối đến MongoDB"))
  .catch((err) => console.error("Lỗi kết nối MongoDB:", err));

// Model sản phẩm
const productSchema = new mongoose.Schema({
  name: String,
  slug: String,
  imageUrl: String,
  imageUrl2: String,
  // Các trường khác
});

const Product = mongoose.model("Product", productSchema);

// Đường dẫn thư mục lưu ảnh
const productsDir = path.join(__dirname, "../public/images/products");

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(productsDir)) {
  fs.mkdirSync(productsDir, { recursive: true });
}

// Hàm tải ảnh từ URL
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

// Danh sách ảnh sản phẩm từ Unsplash (miễn phí sử dụng)
const imageUrls = {
  "iphone-15-pro-max":
    "https://images.unsplash.com/photo-1632661674596-df8be070a5c5",
  "galaxy-s24-ultra":
    "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd",
  "macbook-pro-16":
    "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9",
  "dell-xps-15": "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed",
  "ipad-pro-m2": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
  "apple-watch-s9":
    "https://images.unsplash.com/photo-1579586337278-3befd40fd17a",
  "airpods-pro-2":
    "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb",
  "xiaomi-14-pro":
    "https://images.unsplash.com/photo-1598327105666-5b89351aff97",
  "lenovo-yoga-9i":
    "https://images.unsplash.com/photo-1593642533144-3d62aa4783ec",
  "placeholder-1":
    "https://images.unsplash.com/photo-1517142089942-ba376ce32a2e",
  "placeholder-2":
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
  "placeholder-3":
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30",
  "placeholder-4":
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f",
  "placeholder-5": "https://images.unsplash.com/photo-1546868871-7041f2a55e12",
};

// Hàm chính để tải tất cả các ảnh
async function downloadAllImages() {
  console.log("Bắt đầu tải ảnh...");

  try {
    // Tạo danh sách công việc tải ảnh
    const downloadTasks = [];

    // Với mỗi sản phẩm, tải 2 ảnh (chính và thứ 2)
    for (const [name, url] of Object.entries(imageUrls)) {
      // Ảnh chính
      const mainImagePath = path.join(productsDir, `${name}.jpg`);
      downloadTasks.push(
        downloadImage(url, mainImagePath).then(() =>
          console.log(`Đã tải ảnh ${name}.jpg`)
        )
      );

      // Ảnh thứ 2 (sử dụng cùng URL nhưng lưu với tên khác)
      const secondImagePath = path.join(productsDir, `${name}-2.jpg`);
      downloadTasks.push(
        downloadImage(url, secondImagePath).then(() =>
          console.log(`Đã tải ảnh ${name}-2.jpg`)
        )
      );
    }

    // Chờ tất cả các tác vụ tải hoàn thành
    await Promise.all(downloadTasks);

    console.log("Tải ảnh hoàn tất!");

    // Cập nhật đường dẫn ảnh trong database
    await updateProductImages();
  } catch (error) {
    console.error("Lỗi khi tải ảnh:", error);
  } finally {
    // Đóng kết nối database
    mongoose.connection.close();
  }
}

// Cập nhật đường dẫn ảnh trong database
async function updateProductImages() {
  try {
    const products = await Product.find();

    for (const product of products) {
      // Trích xuất slug từ tên sản phẩm hoặc sử dụng slug hiện có
      const slugName =
        product.slug || product.name.toLowerCase().replace(/\s+/g, "-");

      // Tìm hình ảnh phù hợp từ danh sách đã tải
      let imageBase = findMatchingImage(slugName);

      if (imageBase) {
        // Cập nhật đường dẫn hình ảnh
        product.imageUrl = `/images/products/${imageBase}.jpg`;
        product.imageUrl2 = `/images/products/${imageBase}-2.jpg`;
        await product.save();
        console.log(`Đã cập nhật ảnh cho sản phẩm: ${product.name}`);
      }
    }

    console.log("Cập nhật đường dẫn ảnh trong database hoàn tất!");
  } catch (error) {
    console.error("Lỗi khi cập nhật database:", error);
  }
}

// Tìm hình ảnh phù hợp dựa trên slug
function findMatchingImage(slug) {
  // Tìm khớp chính xác
  if (imageUrls[slug]) {
    return slug;
  }

  // Tìm khớp một phần
  for (const key of Object.keys(imageUrls)) {
    if (slug.includes(key) || key.includes(slug)) {
      return key;
    }
  }

  // Nếu không tìm thấy, sử dụng placeholder
  const placeholders = [
    "placeholder-1",
    "placeholder-2",
    "placeholder-3",
    "placeholder-4",
    "placeholder-5",
  ];
  const randomIndex = Math.floor(Math.random() * placeholders.length);
  return placeholders[randomIndex];
}

// Chạy script
downloadAllImages();
