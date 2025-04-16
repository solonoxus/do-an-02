const mongoose = require("mongoose");

const orderHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    prevStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      required: true,
    },
    prevPaymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
    },
    newPaymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const OrderHistory = mongoose.model("OrderHistory", orderHistorySchema);

module.exports = OrderHistory;
