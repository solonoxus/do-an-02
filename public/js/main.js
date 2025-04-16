// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize Bootstrap tooltips
  const tooltipTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
  );
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });

  // Initialize Bootstrap popovers
  const popoverTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]')
  );
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });

  // Auto-close alerts after 5 seconds
  setTimeout(function () {
    document.querySelectorAll(".alert").forEach(function (alert) {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    });
  }, 5000);

  // Quantity input controls in product detail page
  const quantityInput = document.getElementById("quantity");
  if (quantityInput) {
    // Get max stock value
    const maxStock = parseInt(quantityInput.getAttribute("max"));

    // Increment button
    document.querySelector(".qty-inc")?.addEventListener("click", function () {
      let currentVal = parseInt(quantityInput.value);
      if (!isNaN(currentVal) && currentVal < maxStock) {
        quantityInput.value = currentVal + 1;
      }
    });

    // Decrement button
    document.querySelector(".qty-dec")?.addEventListener("click", function () {
      let currentVal = parseInt(quantityInput.value);
      if (!isNaN(currentVal) && currentVal > 1) {
        quantityInput.value = currentVal - 1;
      }
    });

    // Ensure quantity is within range
    quantityInput.addEventListener("change", function () {
      let currentVal = parseInt(this.value);
      if (isNaN(currentVal) || currentVal < 1) {
        this.value = 1;
      } else if (currentVal > maxStock) {
        this.value = maxStock;
      }
    });
  }

  // Product image gallery in product detail page
  const thumbnails = document.querySelectorAll(".thumbnail-container");
  if (thumbnails.length > 0) {
    thumbnails.forEach(function (thumbnail) {
      thumbnail.addEventListener("click", function () {
        // Remove active class from all thumbnails
        thumbnails.forEach(function (thumb) {
          thumb.classList.remove("active");
        });

        // Add active class to clicked thumbnail
        this.classList.add("active");
      });
    });
  }

  // Handle form validation
  const forms = document.querySelectorAll(".needs-validation");
  if (forms.length > 0) {
    Array.from(forms).forEach(function (form) {
      form.addEventListener(
        "submit",
        function (event) {
          if (!form.checkValidity()) {
            event.preventDefault();
            event.stopPropagation();
          }

          form.classList.add("was-validated");
        },
        false
      );
    });
  }

  // Cart page quantity update
  const cartForm = document.querySelector('form[action="/cart/update"]');
  if (cartForm) {
    const quantityInputs = cartForm.querySelectorAll(
      'input[name^="items"][name$="[quantity]"]'
    );

    quantityInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        if (parseInt(this.value) === 0) {
          if (confirm("Bạn có chắc muốn xóa sản phẩm này khỏi giỏ hàng?")) {
            // Allow form submission with zero quantity
          } else {
            this.value = 1; // Reset to 1 if user cancels
          }
        }
      });
    });
  }

  // Payment method selection on checkout page
  const paymentMethods = document.querySelectorAll(
    'input[name="paymentMethod"]'
  );
  if (paymentMethods.length > 0) {
    paymentMethods.forEach(function (method) {
      method.addEventListener("change", function () {
        // Hide all payment details sections
        document
          .querySelectorAll(".payment-details")
          .forEach(function (details) {
            details.classList.add("d-none");
          });

        // Show selected payment details section
        const selectedDetails = document.querySelector(
          "#" + this.value + "-details"
        );
        if (selectedDetails) {
          selectedDetails.classList.remove("d-none");
        }
      });
    });
  }

  // Back to top button
  const backToTopBtn = document.getElementById("back-to-top");
  if (backToTopBtn) {
    window.addEventListener("scroll", function () {
      if (window.pageYOffset > 300) {
        backToTopBtn.classList.add("show");
      } else {
        backToTopBtn.classList.remove("show");
      }
    });

    backToTopBtn.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
});
