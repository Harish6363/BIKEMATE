const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride" },
  conversationId: { type: String, required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, default: "User" },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: { type: String, required: true },
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  sentAt: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
