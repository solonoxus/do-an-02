const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  image: {
    type: String,
  },
  parent: {
    type: Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  featured: {
    type: Boolean,
    default: false,
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

const Category = mongoose.model("Category", CategorySchema);

module.exports = Category;
