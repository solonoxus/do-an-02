const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcryptjs");

// Load User model
const User = require("../models/User");

module.exports = function (passport) {
  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          // Tìm user theo email
          const user = await User.findOne({ email: email });

          if (!user) {
            return done(null, false, { message: "Email chưa được đăng ký" });
          }

          // So sánh mật khẩu
          bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) throw err;

            if (isMatch) {
              return done(null, user);
            } else {
              return done(null, false, { message: "Mật khẩu không đúng" });
            }
          });
        } catch (err) {
          console.error(err);
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};
