const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  usn: { type: String, sparse: true },
  employeeId: { type: String, sparse: true },
  userType: { type: String, enum: ['student', 'faculty'], default: 'student' },
  college: { type: String, required: true },
  department: { type: String, default: 'AIML' },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String },
  password: { type: String },
  password_hash: { type: String },
  idCardImageUrl: { type: String },
  idCardHash: { type: String, sparse: true },
  ocrExtractedData: { 
    name: String, 
    usn: String, 
    employeeId: String,
    userType: String,
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
    enum: ["student", "faculty", "admin", "driver", "rider"],
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
  bikeName: { type: String, default: 'Royal Enfield Hunter 350' },
  bikeNumber: { type: String, default: 'KA-34-EA-4412' },
  emergencyPhone: { type: String, default: '9876543210' },
  themePreference: { type: String, enum: ['light', 'dark', 'system'], default: 'light' },
  deletedConversations: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

userSchema.index({ homeLocation: "2dsphere" }, { sparse: true });

const User = mongoose.model('User', userSchema);
module.exports = User;
