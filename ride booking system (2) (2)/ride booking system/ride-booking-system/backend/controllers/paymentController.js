const Payment = require('../models/Payment');
const Ride = require('../models/Ride');
const mongoose = require('mongoose');

const sendError = (res, status, message, error) => {
  const payload = { message };
  if (error?.message) {
    payload.error = error.message;
  }
  return res.status(status).json(payload);
};

const isTransactionUnsupported = (error) =>
  error?.message?.includes('Transaction numbers are only allowed on a replica set member or mongos');

exports.makePayment = async (req, res) => {
  let session;
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { rideId, method } = req.body;
    if (!rideId) return sendError(res, 400, 'Ride ID is required');

    const selectedMethod = ['card', 'upi', 'cash'].includes(method) ? method : 'card';

    let payment;

    try {
      session = await mongoose.startSession();
      session.startTransaction();

      const ride = await Ride.findById(rideId).session(session);
      if (!ride) {
        await session.abortTransaction();
        return sendError(res, 404, 'Ride not found');
      }
      if (ride.status === 'cancelled') {
        await session.abortTransaction();
        return sendError(res, 400, 'Cancelled rides cannot be paid');
      }

      const existingPayment = await Payment.findOne({ ride: rideId }).session(session);
      if (existingPayment && existingPayment.status === 'paid') {
        await session.abortTransaction();
        return sendError(res, 400, 'Already paid');
      }

      payment = await Payment.findOneAndUpdate(
        { ride: rideId },
        { customer: req.session.user.id, driver: ride.driver, amount: ride.fare, status: 'paid', method: selectedMethod, paidAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true, session }
      );

      ride.status = 'completed';
      ride.completedAt = new Date();
      await ride.save({ session });
      await session.commitTransaction();
    } catch (error) {
      if (session?.inTransaction()) {
        await session.abortTransaction();
      }

      if (!isTransactionUnsupported(error)) {
        throw error;
      }

      const ride = await Ride.findById(rideId);
      if (!ride) {
        return sendError(res, 404, 'Ride not found');
      }
      if (ride.status === 'cancelled') {
        return sendError(res, 400, 'Cancelled rides cannot be paid');
      }

      const existingPayment = await Payment.findOne({ ride: rideId });
      if (existingPayment && existingPayment.status === 'paid') {
        return sendError(res, 400, 'Already paid');
      }

      payment = await Payment.findOneAndUpdate(
        { ride: rideId },
        { customer: req.session.user.id, driver: ride.driver, amount: ride.fare, status: 'paid', method: selectedMethod, paidAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      ride.status = 'completed';
      ride.completedAt = new Date();
      await ride.save();
    }

    res.json({ message: 'Payment successful (dummy gateway)', payment });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    sendError(res, 500, 'Server error', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

exports.getPayments = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { role, id } = req.session.user;
    const query = role === 'admin' ? {} : role === 'driver' ? { driver: id } : { customer: id };
    const payments = await Payment.find(query).populate('ride customer driver', 'pickup dropoff fare paymentMethod name email');
    res.json(payments);
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};
