const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  offeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  origin: { 
    type: { type: String, default: "Point" }, 
    coordinates: [Number] 
  },
  originAddress: { type: String },
  destination: { 
    type: { type: String, default: "Point" }, 
    coordinates: [Number] 
  },
  destAddress: { type: String },
  routePolyline: { type: String },
  distanceKm: { type: Number, default: 8.5 },
  ratePerKm: { type: Number, default: 2 },
  departureTime: { type: Date, required: true },
  seatsAvailable: { type: Number, required: true, default: 1, min: 0, max: 1 },
  pricePerSeat: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["active", "full", "in_progress", "completed", "cancelled"], 
    default: "active" 
  },
  startedAt: { type: Date },
  completedAt: { type: Date },
  
  // Secure Boarding PIN fields (hashed with bcrypt, encrypted for authorized commuter display)
  boardingPinHash: { type: String },
  boardingPinEncrypted: { type: String },
  boardingPinExpiresAt: { type: Date },
  pinVerificationAttempts: { type: Number, default: 0 },
  maxPinAttempts: { type: Number, default: 5 },

  bikeName: { type: String, default: "Royal Enfield Hunter" },
  bikeNumber: { type: String, default: "KA-34-EA-4412" },
  gender: {
    type: String,
    enum: ["female", "male"],
    default: "male"
  },
  createdAt: { type: Date, default: Date.now }
});

rideSchema.index({ origin: "2dsphere" });
rideSchema.index({ destination: "2dsphere" });
rideSchema.index({ gender: 1, status: 1 });
rideSchema.index({ offeredBy: 1, status: 1 });
rideSchema.index({ departureTime: 1 });

const Ride = mongoose.model('Ride', rideSchema);
module.exports = Ride;
