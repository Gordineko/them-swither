import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  client_name: { type: String },
  phone: { type: String },
  comment: { type: String },
  created_at: { type: Date, default: Date.now },
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
