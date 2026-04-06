const User = require('../models/User');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }
    const user = await User.create({ name, email, password, role, phone });
    req.session.user = { id: user._id, role: user.role, name: user.name, email: user.email };
    res.status(201).json({ message: 'Registered successfully', user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }
    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    req.session.user = { id: user._id, role: user.role, name: user.name, email: user.email };
    res.json({ message: 'Logged in', user: req.session.user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed', err });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
};

exports.getProfile = async (req, res) => {
  try {
    if (!req.session.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const user = await User.findById(req.session.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!req.session.user?.id) return res.status(401).json({ message: 'Unauthorized' });
    const updates = (({ name, phone, password }) => ({ name, phone, password }))(req.body);
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (updates.name) user.name = updates.name;
    if (updates.phone) user.phone = updates.phone;
    if (updates.password) user.password = updates.password;
    await user.save();
    res.json({ message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
