const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  salePrice: {
    type: Number,
  },
  category: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
  },
  images: [
    {
      type: String,
    },
  ],
  mainImage: {
    type: String,
    required: true,
  },
  featured: {
    type: Boolean,
    default: false,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  specifications: {
    type: Object,
  },
  ratings: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true,
      },
      review: String,
      date: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  averageRating: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Tính lại điểm trung bình đánh giá trước khi lưu
ProductSchema.pre("save", function (next) {
  if (this.ratings && this.ratings.length > 0) {
    this.averageRating =
      this.ratings.reduce((sum, item) => sum + item.rating, 0) /
      this.ratings.length;
  }
  this.updatedAt = Date.now();
  next();
});

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;
