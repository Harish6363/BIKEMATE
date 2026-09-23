const mongoose = require('mongoose');

const rideRequestSchema = new mongoose.Schema({
  ride: { type: mongoose.Schema.Types.ObjectId, ref: "Ride", required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { 
    type: String, 
    enum: ["pending", "accepted", "rejected"], 
    default: "pending" 
  },
  seatsRequested: { type: Number, default: 1 },
  pickupAddress: { type: String },
  distanceKm: { type: Number, default: 8.5 },
  calculatedFare: { type: Number, default: 17 },
  createdAt: { type: Date, default: Date.now }
});

const RideRequest = mongoose.model('RideRequest', rideRequestSchema);
module.exports = RideRequest;
