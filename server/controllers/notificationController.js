const Notification = require('../models/Notification');

// Helper to create and push a notification
exports.createNotification = async ({ recipient, sender, type, title, message, rideId, actionUrl }) => {
  try {
    const notif = await Notification.create({
      recipient,
      sender,
      type,
      title,
      message,
      rideId,
      actionUrl: actionUrl || '/rides'
    });

    // If socket.io is attached to global, emit instant notification to user room
    if (global.io) {
      global.io.to(`user_${recipient}`).emit('newNotification', notif);
      // Also emit update to badge count
      const unreadCount = await Notification.countDocuments({ recipient, read: false });
      global.io.to(`user_${recipient}`).emit('unreadCountUpdate', { unreadCount });
    }

    return notif;
  } catch (err) {
    console.warn('Failed to create notification:', err.message);
    return null;
  }
};

// 1. Get all notifications for authenticated user
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name usn college phone')
      .populate('rideId', 'originAddress destAddress departureTime status pricePerSeat')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
};

// 2. Mark specific notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notif = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true },
      { new: true }
    );

    if (!notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const unreadCount = await Notification.countDocuments({ recipient: userId, read: false });
    res.status(200).json({ message: 'Marked as read', notif, unreadCount });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ message: 'Error updating notification', error: error.message });
  }
};

// 3. Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.updateMany({ recipient: userId, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked as read', unreadCount: 0 });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ message: 'Error marking all as read', error: error.message });
  }
};

// 4. Clear all notifications
exports.clearAll = async (req, res) => {
  try {
    const userId = req.user._id;
    await Notification.deleteMany({ recipient: userId });
    res.status(200).json({ message: 'All notifications cleared', unreadCount: 0 });
  } catch (error) {
    console.error('clearAll error:', error);
    res.status(500).json({ message: 'Error clearing notifications', error: error.message });
  }
};
