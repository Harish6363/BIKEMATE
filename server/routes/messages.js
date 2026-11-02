const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMessages,
  sendMessage,
  deleteMessage,
  deleteConversation,
  getDeletedConversations,
  bulkDeleteConversations
} = require('../controllers/messageController');

// All message routes require user authentication
router.use(auth);

router.get('/deleted-conversations', getDeletedConversations);
router.post('/bulk-delete', bulkDeleteConversations);
router.get('/:conversationId', getMessages);
router.post('/', sendMessage);
router.delete('/:messageId', deleteMessage);
router.delete('/conversation/:conversationId', deleteConversation);

module.exports = router;
