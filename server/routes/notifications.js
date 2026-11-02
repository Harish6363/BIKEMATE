const express = require('express');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearAll
} = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const router = express.Router();

router.use(auth);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/clear', clearAll);

module.exports = router;
