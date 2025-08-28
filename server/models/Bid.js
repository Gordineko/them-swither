import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
  name: { type: String },
  phone: { type: String },
  product: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  question: { type: String },               // если нужна
  company: { type: String },               // если нужна
  formType: {
    type: String,
    enum: ["contact", "callback", "partner"], // ваши три типа
    required: true
  },
  created_at: { type: Date, default: Date.now }
});

const Bid = mongoose.model("Bid", bidSchema);

export default Bid;
