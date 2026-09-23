const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  usn: { type: String, required: true, sparse: true },
  college: { type: String, required: true },
  department: { type: String, default: 'AIML' },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  idCardImageUrl: { type: String },
  idCardHash: { type: String, sparse: true },
  ocrExtractedData: { 
    name: String, 
    usn: String, 
    college: String,
    department: String
  },
  verificationStatus: { 
    type: String, 
    enum: ["pending", "verified", "rejected"], 
    default: "pending" 
  },
  homeLocation: { 
    type: { type: String, enum: ['Point'], default: 'Point' }, 
    coordinates: { type: [Number], default: [76.9214, 15.1394] } 
  },
  role: {
    type: String,
    enum: ["student", "admin", "driver", "rider"],
    default: "student"
  },
  gender: {
    type: String,
    enum: ["female", "male"],
    default: "male"
  },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: '' },
  semester: { type: String, default: 'Sem 1' },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ homeLocation: "2dsphere" }, { sparse: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
