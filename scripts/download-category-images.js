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

// Schema và model cho danh mục
const categorySchema = new mongoose.Schema({
  name: String,
  slug: String,
  image: String,
  featured: Boolean,
  // Các trường khác
});

const Category = mongoose.model("Category", categorySchema);

// Đường dẫn thư mục lưu ảnh danh mục
const categoriesDir = path.join(__dirname, "../public/images/categories");

// Đảm bảo thư mục tồn tại
if (!fs.existsSync(categoriesDir)) {
  fs.mkdirSync(categoriesDir, { recursive: true });
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

// Danh sách hình ảnh danh mục với URL hình ảnh từ Unsplash
const categoryImages = {
  "dien-thoai": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
  laptop: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
  tablet: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0",
  smartwatch: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a",
  accessories: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb",
  "home-appliances":
    "https://images.unsplash.com/photo-1583947215259-38e31be8751f",
};

// Hàm chính để tải tất cả các hình ảnh
async function downloadAllImages() {
  console.log("Bắt đầu tải hình ảnh danh mục...");

  try {
    // Tạo danh sách công việc tải hình ảnh
    const downloadTasks = [];

    // Tải từng hình ảnh
    for (const [slug, url] of Object.entries(categoryImages)) {
      const imagePath = path.join(categoriesDir, `${slug}.jpg`);
      downloadTasks.push(
        downloadImage(url, imagePath).then(() =>
          console.log(`Đã tải hình ảnh ${slug}.jpg`)
        )
      );
    }

    // Chờ tất cả các tác vụ tải hoàn thành
    await Promise.all(downloadTasks);

    console.log("Tải hình ảnh danh mục hoàn tất!");

    // Cập nhật đường dẫn hình ảnh trong database
    await updateCategoryImages();
  } catch (error) {
    console.error("Lỗi khi tải hình ảnh danh mục:", error);
  } finally {
    // Đóng kết nối database
    mongoose.connection.close();
  }
}

// Cập nhật đường dẫn hình ảnh trong database
async function updateCategoryImages() {
  try {
    const categories = await Category.find();

    for (const category of categories) {
      // Trích xuất slug từ danh mục
      const slug = category.slug;

      // Kiểm tra xem có hình ảnh tương ứng với slug không
      if (categoryImages[slug]) {
        // Cập nhật đường dẫn hình ảnh
        category.image = `/images/categories/${slug}.jpg`;
        await category.save();
        console.log(`Đã cập nhật hình ảnh cho danh mục: ${category.name}`);
      } else {
        // Nếu không có hình ảnh tương ứng, sử dụng hình ảnh mặc định
        const defaultImage = "accessories"; // Có thể thay đổi thành một hình ảnh mặc định khác
        category.image = `/images/categories/${defaultImage}.jpg`;
        await category.save();
        console.log(
          `Đã cập nhật hình ảnh mặc định cho danh mục: ${category.name}`
        );
      }
    }

    console.log("Cập nhật đường dẫn hình ảnh danh mục hoàn tất!");
  } catch (error) {
    console.error("Lỗi khi cập nhật database:", error);
  }
}

// Chạy script
downloadAllImages();
