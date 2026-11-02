require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const path = require('path');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded ID card images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/messages', require('./routes/messages'));

// Basic route for testing
app.get('/', (req, res) => {
  res.send('BikeMate API is running...');
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Expose io globally for controllers to emit instant notifications
global.io = io;

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Personal user notification room
  socket.on('joinUser', (userId) => {
    if (userId) {
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined personal notification room user_${userId}`);
    }
  });

  // Live Ride Tracking Rooms
  socket.on('joinRide', (rideId) => {
    socket.join(`ride_${rideId}`);
    console.log(`Socket ${socket.id} joined live tracking room ride_${rideId}`);
  });

  socket.on('driverGPSUpdate', (data) => {
    // Broadcast live GPS coordinates, speed, and ETA to anyone tracking this ride
    if (data.rideId) {
      io.to(`ride_${data.rideId}`).emit('driverGPSUpdate', data);
    }
    // General broadcast for live campus map
    socket.broadcast.emit('liveDriverMove', data);
  });

  socket.on('rideStatusUpdate', (data) => {
    if (data.rideId) {
      io.to(`ride_${data.rideId}`).emit('rideStatusUpdate', data);
    }
  });

  socket.on('chatMessage', (msg) => {
    socket.broadcast.emit('chatMessage', msg);
  });

  socket.on('deleteMessage', (data) => {
    socket.broadcast.emit('messageDeleted', data);
  });

  socket.on('deleteConversation', (data) => {
    socket.broadcast.emit('conversationDeleted', data);
  });

  // Campus Emergency SOS Real-time Handlers
  socket.on('SOS_TRIGGERED', async (data) => {
    console.log('🚨 [EMERGENCY SOS RECEIVED]:', data);
    // Broadcast to the ride room (passenger and anyone tracking this ride)
    if (data.rideId) {
      io.to(`ride_${data.rideId}`).emit('SOS_TRIGGERED', data);
    }
    // Broadcast immediately to all connected Admin / Campus Security dashboards
    io.emit('ADMIN_SOS_ALERT', data);

    // 1. Create persistent notifications for all Admins and Student in distress
    try {
      const User = require('./models/User');
      const Notification = require('./models/Notification');
      const adminUsers = await User.find({ role: 'admin' });
      for (const admin of adminUsers) {
        await Notification.create({
          recipient: admin._id,
          type: 'SOS_ALERT',
          title: `🚨 EMERGENCY SOS: ${data.userName || 'Student'} in Distress`,
          message: `Student ${data.userName || 'Student'} (${data.userPhone || 'Phone'}) triggered an Emergency SOS during a ride with driver ${data.driverName || 'Driver'} (${data.vehicleNumber || 'Vehicle'}). Emergency Contact: ${data.emergencyPhone || '9876543210'}. Location: ${data.coords?.lat || 15.1394}, ${data.coords?.lng || 76.9214}.`,
          actionUrl: '/admin'
        });
        const unreadCount = await Notification.countDocuments({ recipient: admin._id, read: false });
        io.to(`user_${admin._id}`).emit('unreadCountUpdate', { unreadCount });
      }

      if (data.userId) {
        await Notification.create({
          recipient: data.userId,
          type: 'SOS_ALERT',
          title: '🚨 Emergency SOS Dispatched',
          message: `Campus Security, Admin and your Emergency Contact (${data.emergencyPhone || '9876543210'}) have been alerted with your live GPS location. Stay calm, help is being dispatched.`,
          actionUrl: `/track/${data.rideId || 'latest'}`
        });
        const unreadCount = await Notification.countDocuments({ recipient: data.userId, read: false });
        io.to(`user_${data.userId}`).emit('unreadCountUpdate', { unreadCount });
      }
    } catch (notifErr) {
      console.warn('Failed to auto-create SOS notifications:', notifErr.message);
    }

    // 2. Persist to AuditLog automatically
    try {
      const AuditLog = require('./models/AuditLog');
      await AuditLog.create({
        level: 'SOS',
        actionEvent: 'CAMPUS_SOS_TRIGGERED',
        user: data.userName || data.userPhone || 'Student in Distress',
        details: JSON.stringify({
          rideId: data.rideId,
          coords: data.coords,
          driverName: data.driverName,
          driverPhone: data.driverPhone,
          vehicleNumber: data.vehicleNumber,
          emergencyPhone: data.emergencyPhone || '9876543210',
          reason: data.reason || 'Manual Emergency SOS Triggered',
          timestamp: new Date()
        })
      });
    } catch (err) {
      console.warn('Failed to auto-log SOS:', err.message);
    }
  });

  socket.on('SOS_RESOLVED', (data) => {
    console.log('✅ [EMERGENCY SOS RESOLVED]:', data);
    if (data.rideId) {
      io.to(`ride_${data.rideId}`).emit('SOS_RESOLVED', data);
    }
    io.emit('ADMIN_SOS_RESOLVED', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
