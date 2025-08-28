// models/PasswordResetToken.js
import mongoose from "mongoose";

const passwordResetTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  token: {
    type: String,
    required: true,
  },
  // истекает через 1 час
  expiresAt: {
    type: Date,
    required: true,
    default: () => Date.now() + 1000 * 60 * 60,
  },
});


const PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
export default PasswordResetToken;