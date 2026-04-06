const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const mongoStore = require('connect-mongo');
const morgan = require('morgan');
const helmet = require('helmet');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const authRoutes = require('./routes/authRoutes');
const rideRoutes = require('./routes/rideRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5001',
]);

const sendJsonError = (res, status, message, error) => {
  const payload = { message };
  if (error?.message) {
    payload.error = error.message;
  }
  return res.status(status).json(payload);
};

// Security and middleware
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    if (req.path.startsWith('/api/')) {
      return sendJsonError(res, 400, 'Invalid JSON payload', error);
    }
  }
  return next(error);
});

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ride-booking-system';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Session configuration
const MongoStore = (mongoStore && (mongoStore.default || mongoStore)) || null;
let storeInstance = null;
if (MongoStore) {
  if (typeof MongoStore.create === 'function') {
    storeInstance = MongoStore.create({ mongoUrl: MONGO_URI });
  } else if (typeof MongoStore === 'function') {
    storeInstance = MongoStore({ mongoUrl: MONGO_URI });
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'ride-booking-secret',
  resave: false,
  saveUninitialized: false,
  ...(storeInstance ? { store: storeInstance } : {}),
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 4,
  }
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', (req, res) => sendJsonError(res, 404, 'API route not found'));

// Serve frontend files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath, {
  fallthrough: true,
  index: false
}));

// Root route - serve homepage
app.get('/', (req, res) => {
  console.log('Root route accessed, serving index.html from:', path.join(frontendPath, 'index.html'));
  res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading page');
    }
  });
});

// Handle dashboard routes
app.get('/admin-dashboard.html', (req, res) => {
  if (req.session.user && req.session.user.role === 'admin') {
    res.sendFile(path.join(frontendPath, 'admin-dashboard.html'));
  } else {
    res.redirect('/');
  }
});

app.get('/driver-dashboard.html', (req, res) => {
  if (req.session.user && req.session.user.role === 'driver') {
    res.sendFile(path.join(frontendPath, 'driver-dashboard.html'));
  } else {
    res.redirect('/');
  }
});

app.get('/customer-dashboard.html', (req, res) => {
  if (req.session.user && req.session.user.role === 'customer') {
    res.sendFile(path.join(frontendPath, 'customer-dashboard.html'));
  } else {
    res.redirect('/');
  }
});


const PORT = Number(process.env.PORT) || 5000;

app.get('/health', (req, res) => {
  res.json({ ok: true, port: PORT });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return sendJsonError(res, 404, 'API route not found');
  }

  return res.redirect('/');
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (req.path.startsWith('/api/')) {
    return sendJsonError(res, error.status || 500, error.message || 'Server error', error);
  }

  return res.status(500).send('Server error');
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Start the app with a different port, for example: $env:PORT=${PORT + 1}; npm.cmd start`);
    process.exit(1);
  }

  console.error('Server startup error:', error);
  process.exit(1);
});
