const mongoose = require('mongoose');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Feedback = require('../models/Feedback');

const VEHICLE_BASE_FARE = {
  bike: 10,
  sedan: 18,
  suv: 28,
};

const sendError = (res, status, message, error) => {
  const payload = { message };
  if (error?.message) {
    payload.error = error.message;
  }
  return res.status(status).json(payload);
};

const isTransactionUnsupported = (error) =>
  error?.message?.includes('Transaction numbers are only allowed on a replica set member or mongos');

const TERMINAL_RIDE_STATUSES = ['completed', 'cancelled'];
const RIDE_STATUSES = ['requested', 'accepted', 'in_progress', 'completed', 'cancelled'];

const canAccessRide = (ride, sessionUser) => {
  if (!sessionUser) return false;
  if (sessionUser.role === 'admin') return true;
  if (sessionUser.role === 'customer') {
    return String(ride.customer) === String(sessionUser.id);
  }
  if (sessionUser.role === 'driver') {
    return String(ride.driver) === String(sessionUser.id);
  }
  return false;
};

const populateRideDetails = (rideId) =>
  Ride.findById(rideId).populate('customer driver cancelledBy', 'name email role');

exports.createRide = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const pickup = String(req.body.pickup || '').trim();
    const dropoff = String(req.body.dropoff || '').trim();
    const { fare, vehicle = 'sedan', paymentMethod = 'card' } = req.body;
    console.log('createRide payload:', {
      pickup,
      dropoff,
      vehicle,
      paymentMethod,
      fare,
      userId: req.session.user.id,
      role: req.session.user.role,
    });
    if (!pickup || !dropoff || !vehicle || !paymentMethod) {
      return sendError(res, 400, 'Missing ride details');
    }
    const selectedVehicle = VEHICLE_BASE_FARE[vehicle] ? vehicle : 'sedan';
    const selectedPaymentMethod = ['card', 'upi', 'cash'].includes(paymentMethod) ? paymentMethod : null;
    if (!selectedPaymentMethod) {
      return sendError(res, 400, 'Invalid payment method');
    }
    const resolvedFare = Number(fare) > 0 ? Number(fare) : VEHICLE_BASE_FARE[selectedVehicle];
    const ride = await Ride.create({
      customer: req.session.user.id,
      pickup,
      dropoff,
      vehicle: selectedVehicle,
      paymentMethod: selectedPaymentMethod,
      fare: resolvedFare,
    });
    res.status(201).json({
      message: 'Ride requested',
      ride: {
        ...ride.toObject(),
        vehicle: selectedVehicle,
        paymentMethod: selectedPaymentMethod,
        fare: resolvedFare,
      },
    });
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.getRides = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { role, id } = req.session.user;
    let query = {};
    if (role === 'customer') query = { customer: id };
    else if (role === 'driver') query = { driver: id };

    const rides = await Ride.find(query).populate('customer driver cancelledBy', 'name email role');
    res.json(rides);
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.getAllRides = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return sendError(res, 403, 'Forbidden');
    const rides = await Ride.find().populate('customer driver cancelledBy', 'name email role');
    res.json(rides);
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.assignDriver = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return sendError(res, 403, 'Forbidden');
    const { rideId, driverId } = req.body;
    const ride = await Ride.findById(rideId);
    if (!ride) return sendError(res, 404, 'Ride not found');
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') return sendError(res, 400, 'Invalid driver');
    ride.driver = driverId;
    ride.status = 'accepted';
    await ride.save();
    res.json({ message: 'Driver assigned', ride });
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.updateRideFare = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');

    const { rideId, fare } = req.body;
    const resolvedFare = Number(fare);
    if (!mongoose.Types.ObjectId.isValid(rideId)) {
      return sendError(res, 400, 'Valid ride ID is required');
    }
    if (!rideId || !resolvedFare || resolvedFare <= 0) {
      return sendError(res, 400, 'Valid ride and fare are required');
    }

    const ride = await Ride.findById(rideId);
    if (!ride) return sendError(res, 404, 'Ride not found');

    const isAdmin = req.session.user.role === 'admin';
    const isAssignedDriver =
      req.session.user.role === 'driver' && String(ride.driver) === String(req.session.user.id);

    if (!isAdmin && !isAssignedDriver) {
      return sendError(res, 403, 'Only the assigned driver or an admin can update fare');
    }

    ride.fare = resolvedFare;
    await ride.save();
    return res.json({ message: 'Fare updated', ride });
  } catch (error) {
    return sendError(res, 500, 'Server error', error);
  }
};

exports.updateRideStatus = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { rideId, status } = req.body;
    if (!RIDE_STATUSES.includes(status)) {
      return sendError(res, 400, 'Invalid ride status');
    }
    const ride = await Ride.findById(rideId);
    if (!ride) return sendError(res, 404, 'Ride not found');

    if (!canAccessRide(ride, req.session.user)) {
      return sendError(res, 403, 'You can update only rides you have access to');
    }

    if (TERMINAL_RIDE_STATUSES.includes(ride.status) && ride.status !== status) {
      return sendError(res, 400, `Cannot change a ${ride.status} ride`);
    }

    ride.status = status;
    if (status === 'completed') {
      ride.completedAt = new Date();
    }
    if (status !== 'completed') {
      ride.completedAt = undefined;
    }
    if (status !== 'cancelled') {
      ride.cancelledAt = undefined;
      ride.cancelledBy = undefined;
    }
    await ride.save();
    const updatedRide = await populateRideDetails(ride._id);
    res.json({ message: 'Status updated', ride: updatedRide });
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.cancelRide = async (req, res) => {
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { rideId } = req.params;
    const ride = await Ride.findById(rideId);
    if (!ride) return sendError(res, 404, 'Ride not found');

    if (!canAccessRide(ride, req.session.user)) {
      return sendError(res, 403, 'You can cancel only rides you have access to');
    }

    if (TERMINAL_RIDE_STATUSES.includes(ride.status)) {
      return sendError(res, 400, `Ride is already ${ride.status}`);
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = req.session.user.id;
    ride.completedAt = undefined;
    await ride.save();

    const updatedRide = await populateRideDetails(ride._id);
    return res.json({ message: 'Ride cancelled', ride: updatedRide });
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};

exports.leaveFeedback = async (req, res) => {
  let session;
  try {
    if (!req.session.user) return sendError(res, 401, 'Unauthorized');
    const { rideId, toId, message, rating } = req.body;
    const normalizedMessage = String(message || '').trim();
    const normalizedRating = Number(rating);
    if (!normalizedMessage) return sendError(res, 400, 'Feedback message is required');
    if (!normalizedRating || normalizedRating < 1 || normalizedRating > 5) {
      return sendError(res, 400, 'Feedback rating must be between 1 and 5');
    }

    const feedbackPayload = {
      from: req.session.user.id,
      role: req.session.user.role,
      message: normalizedMessage,
      rating: normalizedRating,
      ride: null,
    };

    if (rideId) {
      if (!mongoose.Types.ObjectId.isValid(rideId)) {
        return sendError(res, 400, 'Invalid ride reference');
      }

      const ride = await Ride.findById(rideId);
      if (!ride) {
        return sendError(res, 404, 'Ride not found');
      }

      feedbackPayload.ride = rideId;
    }

    if (toId) {
      if (!mongoose.Types.ObjectId.isValid(toId)) {
        return sendError(res, 400, 'Invalid recipient reference');
      }

      const user = await User.findById(toId);
      if (!user) {
        return sendError(res, 404, 'Recipient not found');
      }

      feedbackPayload.to = toId;
    }

    let feedback;

    try {
      session = await mongoose.startSession();
      session.startTransaction();
      [feedback] = await Feedback.create([feedbackPayload], { session });
      await session.commitTransaction();
    } catch (error) {
      if (session?.inTransaction()) {
        await session.abortTransaction();
      }

      if (!isTransactionUnsupported(error)) {
        throw error;
      }

      feedback = await Feedback.create(feedbackPayload);
    }

    const populatedFeedback = await Feedback.findById(feedback._id)
      .populate('from to', 'name email role')
      .populate('ride', 'pickup dropoff vehicle customer driver');

    return res.status(201).json({ message: 'Feedback submitted', feedback: populatedFeedback });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return sendError(res, 500, 'Server error', error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find()
      .populate('from to', 'name email role')
      .populate('ride', 'pickup dropoff vehicle customer driver');
    res.json(feedback);
  } catch (error) {
    sendError(res, 500, 'Server error', error);
  }
};
