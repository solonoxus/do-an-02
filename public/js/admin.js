/**
 * Admin Panel JavaScript
 */

// Xử lý upload ảnh và hiển thị preview
function handleImagePreview() {
  const imageInputs = document.querySelectorAll(".image-upload");
  if (!imageInputs.length) return;

  imageInputs.forEach((input) => {
    input.addEventListener("change", function (e) {
      const files = e.target.files;
      const previewContainer = document.querySelector(this.dataset.preview);

      if (!previewContainer) return;

      // Xóa preview hiện tại
      if (this.dataset.single === "true") {
        previewContainer.innerHTML = "";
      }

      // Tạo preview cho mỗi file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();

        reader.onload = function (event) {
          const previewItem = document.createElement("div");
          previewItem.className = "image-preview me-2 mb-2";

          previewItem.innerHTML = `
            <img src="${event.target.result}" alt="Preview">
            <div class="remove-image" data-index="${i}">
              <i class="fas fa-times"></i>
            </div>
          `;

          previewContainer.appendChild(previewItem);

          // Xử lý nút xóa ảnh
          previewItem
            .querySelector(".remove-image")
            .addEventListener("click", function () {
              previewItem.remove();

              // Tạo FileList mới không có file đã xóa
              const dataTransfer = new DataTransfer();
              for (let j = 0; j < input.files.length; j++) {
                if (j !== parseInt(this.dataset.index)) {
                  dataTransfer.items.add(input.files[j]);
                }
              }
              input.files = dataTransfer.files;
            });
        };

        reader.readAsDataURL(file);
      }
    });
  });
}

// Xử lý thêm/xóa trường thông số kỹ thuật
function handleSpecifications() {
  const specContainer = document.getElementById("specifications-container");
  if (!specContainer) return;

  // Thêm thông số mới
  document.getElementById("add-spec").addEventListener("click", function () {
    const index = document.querySelectorAll(".spec-item").length;
    const newSpec = document.createElement("div");
    newSpec.className = "spec-item row mb-2";

    newSpec.innerHTML = `
      <div class="col-md-5">
        <input type="text" class="form-control" name="spec-key-${index}" placeholder="Tên thông số">
      </div>
      <div class="col-md-6">
        <input type="text" class="form-control" name="spec-value-${index}" placeholder="Giá trị">
      </div>
      <div class="col-md-1">
        <button type="button" class="btn btn-outline-danger remove-spec">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;

    specContainer.appendChild(newSpec);

    // Xử lý nút xóa thông số
    newSpec
      .querySelector(".remove-spec")
      .addEventListener("click", function () {
        newSpec.remove();
        updateSpecificationsJson();
      });

    // Thêm sự kiện oninput cho các trường nhập liệu
    const inputs = newSpec.querySelectorAll("input");
    inputs.forEach((input) => {
      input.addEventListener("input", updateSpecificationsJson);
    });
  });

  // Cập nhật JSON thông số kỹ thuật
  function updateSpecificationsJson() {
    const specItems = document.querySelectorAll(".spec-item");
    const specificationsJson = {};

    specItems.forEach((item, index) => {
      const keyInput = item.querySelector(`input[name="spec-key-${index}"]`);
      const valueInput = item.querySelector(
        `input[name="spec-value-${index}"]`
      );

      if (keyInput && valueInput && keyInput.value.trim() !== "") {
        specificationsJson[keyInput.value.trim()] = valueInput.value.trim();
      }
    });

    // Cập nhật trường ẩn chứa JSON
    const specJsonInput = document.getElementById("specifications");
    if (specJsonInput) {
      specJsonInput.value = JSON.stringify(specificationsJson);
    }
  }

  // Xử lý nút xóa cho các thông số hiện có
  document.querySelectorAll(".remove-spec").forEach((button) => {
    button.addEventListener("click", function () {
      this.closest(".spec-item").remove();
      updateSpecificationsJson();
    });
  });

  // Xử lý sự kiện oninput cho các trường hiện có
  document.querySelectorAll(".spec-item input").forEach((input) => {
    input.addEventListener("input", updateSpecificationsJson);
  });
}

// Xử lý tạo slug tự động
function handleSlugGeneration() {
  const nameInput = document.getElementById("name");
  const slugInput = document.getElementById("slug");

  if (nameInput && slugInput) {
    // Xử lý tự động tạo slug
    nameInput.addEventListener("input", function () {
      if (!slugInput.value || slugInput.dataset.autoGenerated === "true") {
        slugInput.value = generateSlug(nameInput.value);
        slugInput.dataset.autoGenerated = "true";
      }
    });

    slugInput.addEventListener("input", function () {
      slugInput.dataset.autoGenerated = "false";
    });
  }
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-");
}

// Khởi tạo tất cả các chức năng
document.addEventListener("DOMContentLoaded", function () {
  handleImagePreview();
  handleSpecifications();
  handleSlugGeneration();
});

// Xử lý thêm thông số kỹ thuật sản phẩm
document.addEventListener("DOMContentLoaded", function () {
  const addSpecBtn = document.getElementById("addSpecBtn");

  if (addSpecBtn) {
    console.log("Đã tìm thấy nút thêm thông số");

    addSpecBtn.addEventListener("click", function (e) {
      e.preventDefault();
      console.log("Nút thêm thông số được click");

      const container = document.getElementById("specificationsContainer");
      if (!container) {
        console.error(
          'Không tìm thấy container chứa thông số (id="specificationsContainer")'
        );
        return;
      }

      // Xóa thông báo "Chưa có thông số" nếu có
      const emptyMessage = container.querySelector("p.text-muted");
      if (emptyMessage) {
        container.removeChild(emptyMessage);
      }

      // Tạo hàng mới cho thông số
      const row = document.createElement("div");
      row.className = "row mb-3 spec-row";
      row.innerHTML = `
                <div class="col-md-5">
                    <input type="text" class="form-control" name="specKeys[]" placeholder="Tên thông số">
                </div>
                <div class="col-md-5">
                    <input type="text" class="form-control" name="specValues[]" placeholder="Giá trị">
                </div>
                <div class="col-md-2">
                    <button type="button" class="btn btn-danger btn-sm remove-spec">
                        <i class="fas fa-times"></i> Xóa
                    </button>
                </div>
            `;

      container.appendChild(row);

      // Gán sự kiện xóa cho nút xóa
      const removeBtn = row.querySelector(".remove-spec");
      removeBtn.addEventListener("click", function () {
        container.removeChild(row);

        // Nếu không còn thông số nào, hiển thị lại thông báo
        if (container.querySelectorAll(".spec-row").length === 0) {
          const message = document.createElement("p");
          message.className = "text-muted";
          message.textContent =
            'Chưa có thông số kỹ thuật nào. Nhấn "Thêm thông số" để thêm mới.';
          container.appendChild(message);
        }
      });
    });
  }

  // Xử lý các nút xóa thông số đã có
  document.querySelectorAll(".remove-spec").forEach(function (button) {
    button.addEventListener("click", function () {
      const row = button.closest(".spec-row");
      const container = document.getElementById("specificationsContainer");
      container.removeChild(row);

      // Nếu không còn thông số nào, hiển thị lại thông báo
      if (container.querySelectorAll(".spec-row").length === 0) {
        const message = document.createElement("p");
        message.className = "text-muted";
        message.textContent =
          'Chưa có thông số kỹ thuật nào. Nhấn "Thêm thông số" để thêm mới.';
        container.appendChild(message);
      }
    });
  });
});
