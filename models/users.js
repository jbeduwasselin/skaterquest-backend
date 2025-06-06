const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  uID: String,
  username: String,
  email: { type: String, match: /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/i },
  password: String,
  inscriptionDate: Date,
  personalScore: { type: Number, default: 0 },
  avatar: String,
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "users" }],
  crew: { type: mongoose.Schema.Types.ObjectId, ref: "crews" },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: "videos" }],
});

const User = mongoose.model("users", userSchema);

module.exports = User;
