const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  type: {
    type: String,
    enum: [
      'RIDE_REQUEST',
      'RIDE_ACCEPTED',
      'RIDE_REJECTED',
      'RIDE_STARTED',
      'RIDE_COMPLETED',
      'RIDE_UPDATE',
      'RIDE_CANCELLED',
      'SOS_ALERT',
      'SYSTEM'
    ],
    default: 'SYSTEM'
  },
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  rideId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ride' 
  },
  actionUrl: { 
    type: String, 
    default: '/rides' 
  },
  read: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true 
  }
});

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
