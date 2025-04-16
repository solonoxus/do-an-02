const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    default: "",
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String,
  },
  role: {
    type: String,
    enum: ["user", "staff", "manager", "admin", "superadmin"],
    default: "user",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  avatar: {
    type: String,
    default: "",
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  wishlist: [
    {
      type: Schema.Types.ObjectId,
      ref: "Product",
    },
  ],
  lastLogin: Date,
});

// Các virtual properties để kiểm tra quyền
UserSchema.virtual("isAdmin").get(function () {
  return ["admin", "superadmin"].includes(this.role);
});

UserSchema.virtual("isSuperAdmin").get(function () {
  return this.role === "superadmin";
});

UserSchema.virtual("isManager").get(function () {
  return ["manager", "admin", "superadmin"].includes(this.role);
});

UserSchema.virtual("isStaff").get(function () {
  return ["staff", "manager", "admin", "superadmin"].includes(this.role);
});

// Đảm bảo virtual properties được bao gồm khi chuyển đổi sang JSON
UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });

const User = mongoose.model("User", UserSchema);

module.exports = User;
