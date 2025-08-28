import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String,  }, // имя счетчика, например, "productId"
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model("Counter", counterSchema);
export default Counter;
