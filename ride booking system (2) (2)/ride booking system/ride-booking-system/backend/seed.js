const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Ride = require('./models/Ride');
const Payment = require('./models/Payment');
const Feedback = require('./models/Feedback');

dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ride-booking-system';

const seed = async () => {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('DB connected');
  await User.deleteMany();
  await Ride.deleteMany();
  await Payment.deleteMany();
  await Feedback.deleteMany();

  const admin = await User.create({ name: 'Admin User', email: 'admin@ride.com', password: 'Admin123!', role: 'admin', phone: '1111111111' });
  const customer = await User.create({ name: 'Customer User', email: 'customer@ride.com', password: 'Customer123!', role: 'customer', phone: '2222222222' });
  const driver = await User.create({ name: 'Driver User', email: 'driver@ride.com', password: 'Driver123!', role: 'driver', phone: '3333333333' });

  const ride = await Ride.create({ customer: customer._id, driver: driver._id, pickup: '10 First St', dropoff: '20 Second St', fare: 25, status: 'completed', completedAt: new Date() });
  await Payment.create({ ride: ride._id, customer: customer._id, driver: driver._id, amount: 25, status: 'paid', method: 'card', paidAt: new Date() });
  await Feedback.create({ ride: ride._id, from: customer._id, to: driver._id, role: 'customer', message: 'Great ride', rating: 5 });

  console.log('Seed done');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
