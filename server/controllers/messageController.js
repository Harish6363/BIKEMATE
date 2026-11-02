const Message = require('../models/Message');
const User = require('../models/User');
const RideRequest = require('../models/RideRequest');

// 1. Get messages for a specific conversation (filtered for the requesting user)
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    const convIds = [conversationId];

    // If conversationId is a RideRequest ID, also look for messages tagged with the user-pair ID
    try {
      const reqDoc = await RideRequest.findById(conversationId).populate('ride');
      if (reqDoc) {
        const driverId = (reqDoc.driver?._id || reqDoc.driver || reqDoc.ride?.offeredBy)?.toString();
        const requesterId = (reqDoc.requester?._id || reqDoc.requester)?.toString();
        if (driverId && requesterId) {
          convIds.push([driverId, requesterId].sort().join('_'));
        }
      }
    } catch (e) {
      // not an ObjectId, ignore
    }

    const messages = await Message.find({
      conversationId: { $in: convIds },
      deletedFor: { $ne: userId }
    }).sort({ sentAt: 1 });

    const formatted = messages.map(m => ({
      _id: m._id,
      text: m.content,
      sender: m.senderName || 'Student',
      senderId: m.sender.toString(),
      isMe: m.sender.toString() === userId.toString(),
      timestamp: m.sentAt,
      conversationId: m.conversationId
    }));

    res.status(200).json(formatted);
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
};

// 2. Send a new message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, rideId, text, receiverId } = req.body;
    const userId = req.user._id;
    const userName = req.user.name;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const newMsg = await Message.create({
      ride: rideId || null,
      conversationId,
      sender: userId,
      senderName: userName,
      receiver: receiverId || null,
      content: text.trim(),
      deletedFor: [],
      sentAt: new Date()
    });

    const formatted = {
      _id: newMsg._id,
      text: newMsg.content,
      sender: newMsg.senderName,
      senderId: userId.toString(),
      timestamp: newMsg.sentAt,
      conversationId
    };

    // Emit live to Socket.io
    if (global.io) {
      if (rideId) {
        global.io.to(`ride_${rideId}`).emit('chatMessage', formatted);
      }
      global.io.emit('chatMessage', formatted);
    }

    res.status(201).json(formatted);
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
};

// 3. Delete an individual message (for the requesting user)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const updated = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { deletedFor: userId } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (global.io) {
      global.io.emit('messageDeleted', {
        messageId,
        conversationId: updated.conversationId,
        deletedByUserId: userId.toString()
      });
    }

    res.status(200).json({ success: true, message: 'Message deleted successfully', messageId });
  } catch (err) {
    console.error('deleteMessage error:', err);
    res.status(500).json({ message: 'Error deleting message', error: err.message });
  }
};

// 4. Delete / Clear an entire conversation (for the requesting user)
exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;

    // 1. Mark all existing messages in this conversation as deleted for this user
    await Message.updateMany(
      { conversationId },
      { $addToSet: { deletedFor: userId } }
    );

    // 2. Add conversationId to user's deletedConversations list
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { deletedConversations: conversationId } }
    );

    if (global.io) {
      global.io.emit('conversationDeleted', {
        conversationId,
        deletedByUserId: userId.toString()
      });
    }

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully from your view',
      conversationId
    });
  } catch (err) {
    console.error('deleteConversation error:', err);
    res.status(500).json({ message: 'Error deleting conversation', error: err.message });
  }
};

// 5. Get list of conversation IDs deleted by current user
exports.getDeletedConversations = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('deletedConversations');
    res.status(200).json(user?.deletedConversations || []);
  } catch (err) {
    console.error('getDeletedConversations error:', err);
    res.status(500).json({ message: 'Error fetching deleted conversations', error: err.message });
  }
};

// 6. Bulk delete multiple / all completed conversations
exports.bulkDeleteConversations = async (req, res) => {
  try {
    const { conversationIds } = req.body;
    const userId = req.user._id;

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ message: 'No conversation IDs provided' });
    }

    await Message.updateMany(
      { conversationId: { $in: conversationIds } },
      { $addToSet: { deletedFor: userId } }
    );

    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { deletedConversations: { $each: conversationIds } } }
    );

    res.status(200).json({
      success: true,
      message: `${conversationIds.length} conversations deleted successfully`,
      conversationIds
    });
  } catch (err) {
    console.error('bulkDeleteConversations error:', err);
    res.status(500).json({ message: 'Error bulk deleting conversations', error: err.message });
  }
};
