const mongoose = require('mongoose');

const approvedStudentSchema = new mongoose.Schema({
  phoneNumber: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true, 
    index: true 
  },
  name: { 
    type: String, 
    trim: true,
    default: '' 
  },
  usn: { 
    type: String, 
    uppercase: true, 
    trim: true,
    default: '' 
  },
  college: { 
    type: String, 
    default: 'Ballari Institute of Technology and Management', 
    trim: true 
  },
  department: { 
    type: String, 
    default: 'AIML', 
    trim: true 
  },
  registrationStatus: { 
    type: String, 
    enum: ['not_registered', 'registered'], 
    default: 'not_registered' 
  },
  isRegistered: { 
    type: Boolean, 
    default: false 
  },
  registeredUserId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

const ApprovedStudent = mongoose.model('ApprovedStudent', approvedStudentSchema, 'approvedstudents');

module.exports = ApprovedStudent;
