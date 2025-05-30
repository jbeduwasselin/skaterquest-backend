const mongoose = require("mongoose");

const spotsScheme = mongoose.Schema({
  creationDate: Date,
  name: String,
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  category: ["street", "park", "flat"],
  img: [String],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  videos: [{ type: mongoose.Schema.Types.ObjectId, ref: "videos" }],
});

const Spot = mongoose.model("spots", spotsScheme);

module.exports = Spot;
