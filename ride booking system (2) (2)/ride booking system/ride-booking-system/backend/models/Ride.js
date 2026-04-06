const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  pickup: { type: String, required: true, trim: true },
  dropoff: { type: String, required: true, trim: true },
  vehicle: { type: String, enum: ['bike', 'sedan', 'suv'], default: 'sedan' },
  paymentMethod: { type: String, enum: ['card', 'upi', 'cash'], default: 'card' },
  fare: { type: Number, default: null },
  status: { type: String, enum: ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'], default: 'requested' },
  bookedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  cancelledAt: { type: Date },
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Ride', RideSchema);
