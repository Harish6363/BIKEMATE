const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected", "cancelled", "repeat_requested"], 
    default: "pending" 
  },
  seatsRequested: { type: Number, default: 1, max: 1 },
  pickupAddress: { type: String },
  distanceKm: { type: Number, default: 8.5 },
  calculatedFare: { type: Number, default: 17 },

  // Secure Boarding PIN fields
  boardingPinHash: { type: String },
  boardingPinEncrypted: { type: String },
  boardingPinExpiresAt: { type: Date },
  pinVerificationAttempts: { type: Number, default: 0 },
  maxPinAttempts: { type: Number, default: 5 },

  note: { type: String, default: "" },
  requestedDepartureTime: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

rideRequestSchema.index({ requester: 1, status: 1 });
rideRequestSchema.index({ driver: 1, status: 1 });
rideRequestSchema.index({ ride: 1, requester: 1 });

const RideRequest = mongoose.model('RideRequest', rideRequestSchema);
module.exports = RideRequest;
