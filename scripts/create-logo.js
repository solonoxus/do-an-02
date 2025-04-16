const fs = require("fs");
const path = require("path");

// Đường dẫn thư mục lưu ảnh
const imagesDir = path.join(__dirname, "../public/images");
const logoPath = path.join(imagesDir, "logo.png");

// Logo SVG đơn giản
const logoSVG = `
<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg">
  <rect x="10" y="10" width="180" height="40" rx="5" fill="#0d6efd" />
  <text x="100" y="35" font-family="Arial" font-size="24" font-weight="bold" fill="white" text-anchor="middle">SellShop</text>
</svg>
`;

// Chuyển đổi SVG thành PNG
async function createLogo() {
  try {
    // Tạo thư mục nếu chưa tồn tại
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Lưu file SVG tạm thời
    const svgPath = path.join(imagesDir, "temp-logo.svg");
    fs.writeFileSync(svgPath, logoSVG);

    console.log(`Đã tạo file SVG tạm thời tại: ${svgPath}`);
    console.log("Hãy sử dụng SVG này để tạo logo.png");

    // Lưu một nội dung mẫu vào file PNG
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Logo SellShop</title>
      <style>
        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .logo { 
          background-color: #0d6efd; 
          color: white; 
          font-family: Arial, sans-serif;
          font-size: 24px;
          font-weight: bold;
          padding: 10px 20px;
          border-radius: 5px;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="logo">SellShop</div>
    </body>
    </html>
    `;

    const htmlPath = path.join(imagesDir, "logo.html");
    fs.writeFileSync(htmlPath, htmlContent);

    console.log(`Đã tạo file HTML logo tại: ${htmlPath}`);
    console.log(
      "Vì không thể tạo PNG trực tiếp từ Node.js mà không có thư viện, bạn có thể lưu một ảnh logo.png thủ công"
    );
  } catch (error) {
    console.error("Lỗi khi tạo logo:", error);
  }
}

createLogo();
