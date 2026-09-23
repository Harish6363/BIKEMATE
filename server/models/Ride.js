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
  seatsAvailable: { type: Number, required: true },
  pricePerSeat: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ["active", "full", "completed", "cancelled"], 
    default: "active" 
  },
  gender: {
    type: String,
    enum: ["female", "male"],
    default: "male"
  },
  createdAt: { type: Date, default: Date.now }
});

rideSchema.index({ origin: "2dsphere" });
rideSchema.index({ destination: "2dsphere" });
rideSchema.index({ gender: 1 });


const Ride = mongoose.model('Ride', rideSchema);
module.exports = Ride;
