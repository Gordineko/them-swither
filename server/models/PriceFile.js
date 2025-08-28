import mongoose from "mongoose";

const { Schema, model } = mongoose;

const PriceFileSchema = new Schema(
  {
    originalName: { type: String, required: true }, // ім'я файлу від користувача
    fileName:     { type: String, required: true }, // збережене ім'я в ФС
    url:          { type: String, required: true }, // публічне посилання на скачування
    size:         { type: Number, required: true }, // у байтах
    mimeType:     { type: String, required: true },
    uploadedBy:   { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export default model("PriceFile", PriceFileSchema);
