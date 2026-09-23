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

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
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
    msg.sender = 'Other';
    socket.broadcast.emit('chatMessage', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
