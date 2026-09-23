const express = require('express');
const { registerStep1, uploadId, checkUsn, sendOtp, verifyOtp, setPassword, login, changePassword, updateProfile } = require('../controllers/authController');
const upload = require('../middleware/upload');

const router = express.Router();

router.post('/register/step1', registerStep1);
router.post('/register/upload-id', upload.single('idCard'), uploadId);
router.get('/register/check-usn/:usn', checkUsn);
router.post('/register/check-usn', checkUsn);
router.post('/register/send-otp', sendOtp);
router.post('/register/verify-otp', verifyOtp);
router.post('/register/set-password', setPassword);
router.post('/login', login);
router.post('/change-password', changePassword);
router.put('/profile', updateProfile);
router.patch('/profile', updateProfile);

module.exports = router;
