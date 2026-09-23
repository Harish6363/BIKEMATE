const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Authentication required. Please log into your account before finding, offering, or requesting rides.'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({
        message: 'Authentication required. Please log into your account before finding, offering, or requesting rides.'
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        message: 'Session expired or invalid. Please log in again.'
      });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        message: 'User account not found. Please log in with a valid account.'
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        message: `Account is suspended. Reason: ${user.banReason || 'Policy violation'}`
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Server error verifying authentication', error: error.message });
  }
};
