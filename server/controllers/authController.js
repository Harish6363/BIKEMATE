const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

// Helper to clean and validate 10-digit Indian mobile numbers (starts with 6-9)
const cleanAndValidateMobile = (rawPhone) => {
  if (!rawPhone || (typeof rawPhone !== 'string' && typeof rawPhone !== 'number')) {
    return { valid: false, message: 'Mobile number is required' };
  }
  let clean = rawPhone.toString().replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
  if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  
  if (!/^[6-9]\d{9}$/.test(clean)) {
    return { 
      valid: false, 
      message: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9' 
    };
  }
  return { valid: true, phone: clean };
};

// 1. Mobile number validation (Step 1)
exports.registerStep1 = async (req, res) => {
  try {
    const { phone } = req.body;
    const validation = cleanAndValidateMobile(phone);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }
    
    const cleanPhone = validation.phone;
    const existingUser = await User.findOne({ phone: cleanPhone });
    if (existingUser) {
      return res.status(400).json({ message: 'This mobile number is already registered. Please login.' });
    }
    
    res.status(200).json({ message: 'Mobile number validated successfully', phone: cleanPhone });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Branch/Department inference from extracted text and VTU USN (e.g. 3BR23AI034 -> AIML)
const inferDepartment = (extractedDept, usn) => {
  const branchKeywords = [
    { match: /artificial\s*intelligence.*machine\s*learning|\baiml\b/i, code: 'AIML' },
    { match: /artificial\s*intelligence.*data\s*science|\bai&ds\b|\baids\b/i, code: 'AI&DS' },
    { match: /artificial\s*intelligence|\bai\b/i, code: 'AI' },
    { match: /computer\s*science|\bcse\b|\bcs\b/i, code: 'CSE' },
    { match: /electrical.*electronics|\beee\b/i, code: 'EEE' },
    { match: /electronics.*communication|\bece\b/i, code: 'ECE' },
    { match: /information\s*science|\bise\b|\bis\b/i, code: 'ISE' },
    { match: /civil|\bcv\b/i, code: 'Civil' },
    { match: /mechanical|\bme\b/i, code: 'Mechanical' },
    { match: /robotics/i, code: 'Robotics' },
    { match: /\bmca\b|master\s*of\s*computer/i, code: 'MCA' },
    { match: /\bmba\b|master\s*of\s*business/i, code: 'MBA' }
  ];

  // 1. Check extracted department string
  if (extractedDept && typeof extractedDept === 'string') {
    for (const item of branchKeywords) {
      if (item.match.test(extractedDept)) {
        return item.code;
      }
    }
  }

  // 2. Check USN code (VTU standard: e.g. 3BR23AI034 -> 'AI', 3BR22CS045 -> 'CS')
  if (usn && typeof usn === 'string') {
    const cleanUsn = usn.toUpperCase().trim();
    const vtuMatch = cleanUsn.match(/^[0-9][A-Z]{2}\d{2}([A-Z]{2,3})\d{3}$/);
    if (vtuMatch) {
      const code = vtuMatch[1];
      const usnBranchMap = {
        'AI': 'AIML',
        'AM': 'AIML',
        'CS': 'CSE',
        'EC': 'ECE',
        'EE': 'EEE',
        'IS': 'ISE',
        'CV': 'Civil',
        'ME': 'Mechanical',
        'AD': 'AI&DS',
        'DS': 'AI&DS',
        'CD': 'CSD',
        'CB': 'CSBS',
        'BT': 'Biotech',
        'MC': 'MCA',
        'MB': 'MBA'
      };
      if (usnBranchMap[code]) {
        return usnBranchMap[code];
      }
    }
    for (const item of branchKeywords) {
      if (item.match.test(cleanUsn)) {
        return item.code;
      }
    }
  }

  if (extractedDept && typeof extractedDept === 'string' && extractedDept.trim() && extractedDept.toLowerCase() !== 'general') {
    return extractedDept.trim();
  }

  return 'AIML';
};

// 2. ID Upload & OCR via Gemini AI (Free, high accuracy)
exports.uploadId = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file uploaded' });
    }

    // Read image as base64 and compute SHA256 hash
    const imageBuffer = fs.readFileSync(req.file.path);
    const idCardHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    // 1. Check if the exact same image file was already uploaded by any user
    const existingCardByHash = await User.findOne({ idCardHash });
    if (existingCardByHash) {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
      }
      return res.status(400).json({
        success: false,
        isDuplicate: true,
        isDuplicateIdCard: true,
        usn: existingCardByHash.usn,
        message: `Not possible: This ID card has already been uploaded by another student (Registered USN: ${existingCardByHash.usn || 'existing account'}). Duplicate ID cards are not allowed.`
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ message: 'GEMINI_API_KEY is not set in server/.env' });
    }

    const promptText = `You are an ID card OCR extractor. Look at this college student ID card image carefully and extract the following fields.
Return ONLY a valid JSON object with these exact keys (no markdown formatting, no explanation, no backticks):
{
  "name": "full name of the student exactly as printed",
  "usn": "USN or registration number (e.g. 3BR23AI059)",
  "college": "full name of the college or institution",
  "department": "student's course/branch/department, e.g. Artificial Intelligence & Machine Learning, Computer Science, Electrical & Electronics, or code like AIML, CSE, EEE, AI, ECE, etc."
}
If a field cannot be found, set its value to null.`;

    // Try primary model (gemini-3.1-flash-lite) with fallback to (gemini-3.6-flash)
    const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];
    let geminiResponse = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        geminiResponse = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            contents: [{
              parts: [
                { text: promptText },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image
                  }
                }
              ]
            }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            timeout: 30000
          }
        );
        if (geminiResponse && geminiResponse.data) break;
      } catch (err) {
        lastError = err;
        console.warn(`Gemini model ${model} attempt failed, trying next if available...`, err.response?.data?.error?.message || err.message);
      }
    }

    if (!geminiResponse || !geminiResponse.data) {
      throw lastError || new Error('Failed to get response from Gemini AI');
    }

    // Parse the Gemini response
    const rawText = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    console.log('\n===== GEMINI OCR RESPONSE =====\n', rawText, '\n================================\n');

    // Clean up response - extract JSON object even if surrounded by markdown fences
    let extracted = { name: null, usn: null, college: null, department: null };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      } else {
        const cleanJson = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        extracted = JSON.parse(cleanJson);
      }
    } catch (parseErr) {
      console.error('Failed to parse Gemini JSON output:', parseErr.message, rawText);
    }

    // Extract and clean USN for reference checking
    let cleanExtractedUsn = null;
    if (extracted.usn && typeof extracted.usn === 'string') {
      cleanExtractedUsn = extracted.usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
    }

    // 2. Primary Reference Check by USN: Check if any user is already registered with this USN
    if (cleanExtractedUsn) {
      const existingUserByUsn = await User.findOne({
        $or: [
          { usn: cleanExtractedUsn },
          { usn: { $regex: new RegExp(`^${cleanExtractedUsn}$`, 'i') } },
          { 'ocrExtractedData.usn': cleanExtractedUsn },
          { 'ocrExtractedData.usn': { $regex: new RegExp(`^${cleanExtractedUsn}$`, 'i') } }
        ]
      });

      if (existingUserByUsn) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({
          success: false,
          isDuplicate: true,
          isDuplicateUsn: true,
          usn: cleanExtractedUsn,
          message: `Not possible: This ID card is already registered with USN ${cleanExtractedUsn}. Another student has already used this ID card.`
        });
      }
    }

    // Override college with our lookup map if we can identify it
    const collegeMap = [
      { keywords: ['ballari', 'bitm'], name: 'Ballari Institute of Technology and Management' },
      { keywords: ['visvesvaraya', 'vtu'], name: 'Visvesvaraya Technological University' },
      { keywords: ['reva'], name: 'Reva University' },
      { keywords: ['pes university', 'pesu'], name: 'PES University' },
      { keywords: ['rvce', 'rv college'], name: 'RV College of Engineering' },
      { keywords: ['bms'], name: 'BMS College of Engineering' },
      { keywords: ['msrit', 'm s ramaiah'], name: 'M S Ramaiah Institute of Technology' },
    ];

    let finalCollege = extracted.college;
    if (extracted.college) {
      const lower = extracted.college.toLowerCase();
      for (const entry of collegeMap) {
        if (entry.keywords.some(kw => lower.includes(kw))) {
          finalCollege = entry.name;
          break;
        }
      }
    }

    const finalDepartment = inferDepartment(extracted.department, extracted.usn);

    res.status(200).json({
      message: 'ID scanned successfully via Gemini AI',
      extractedName: extracted.name || null,
      extractedUsn: cleanExtractedUsn || (extracted.usn ? extracted.usn.toUpperCase() : null),
      extractedCollege: finalCollege || null,
      extractedDepartment: finalDepartment || 'AIML',
      idCardHash,
      imageUrl: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('Gemini OCR Error:', error.response?.data || error.message);
    res.status(500).json({
      message: 'OCR Failed. Please check your GEMINI_API_KEY in .env',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

// 2b. Check if USN is already registered (Live check)
exports.checkUsn = async (req, res) => {
  try {
    const rawUsn = req.params.usn || req.query.usn || req.body?.usn;
    if (!rawUsn) {
      return res.status(400).json({ message: 'USN is required' });
    }
    const cleanUsn = rawUsn.toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
    const existing = await User.findOne({
      $or: [
        { usn: cleanUsn },
        { usn: { $regex: new RegExp(`^${cleanUsn}$`, 'i') } },
        { 'ocrExtractedData.usn': cleanUsn }
      ]
    });

    if (existing) {
      return res.status(200).json({
        exists: true,
        usn: cleanUsn,
        message: `Not possible: USN ${cleanUsn} is already registered to an existing account.`
      });
    }

    return res.status(200).json({
      exists: false,
      usn: cleanUsn,
      message: 'USN is available'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking USN', error: error.message });
  }
};

// 3. Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email, usn } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Pre-validate USN if provided
    if (usn && typeof usn === 'string' && usn.trim()) {
      const cleanUsn = usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
      const existingUsn = await User.findOne({
        $or: [
          { usn: cleanUsn },
          { usn: { $regex: new RegExp(`^${cleanUsn}$`, 'i') } },
          { 'ocrExtractedData.usn': cleanUsn }
        ]
      });
      if (existingUsn) {
        return res.status(400).json({
          message: `Not possible: USN ${cleanUsn} is already registered with an existing student account.`
        });
      }
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return res.status(400).json({ message: `Email ${trimmedEmail} is already registered. Please login instead.` });
    }

    const isDev = process.env.NODE_ENV === 'development';
    const validDomains = ['.edu', '.ac.in', 'bitm.edu.in', ...(isDev ? ['@gmail.com', '.com', '.org'] : [])];
    const isValidEmail = trimmedEmail && validDomains.some(d => trimmedEmail.includes(d));
    if (!isValidEmail) {
      return res.status(400).json({ message: 'Please use your college email (e.g. @bitm.edu.in)' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Delete any existing OTP for this email before creating a new one
    await OtpVerification.deleteMany({ email });
    await OtpVerification.create({ email, otp, expiresAt });

    // Prominently log OTP to server console for easy testing/debugging
    console.log('\n======================================================');
    console.log(`🔑 [BIKEMATE OTP CODE]`);
    console.log(`📧 Target Email : ${email}`);
    console.log(`🔢 OTP Code     : ${otp}`);
    console.log(`⏰ Expires In   : 10 Minutes`);
    console.log('======================================================\n');

    // Attempt to send OTP via Gmail SMTP if credentials exist
    let emailSent = false;
    let emailErrorMsg = null;

    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const cleanPassword = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: cleanPassword,
          },
        });

        await transporter.sendMail({
          from: `"BikeMate 🏍️" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: 'Your BikeMate Verification OTP',
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #e2e8f0; border-radius: 16px; padding: 40px; border: 1px solid #222235;">
              <h2 style="color: #4361ee; margin-bottom: 8px;">BikeMate 🏍️</h2>
              <p style="color: #9ca3af; margin-bottom: 24px;">Verify your college email to complete registration.</p>
              <div style="background: #1a1a28; border: 1px solid #4361ee33; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 14px;">Your OTP Code</p>
                <p style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #ffffff;">${otp}</p>
              </div>
              <p style="color: #6b7280; font-size: 13px;">This OTP is valid for <strong style="color:#e2e8f0">10 minutes</strong>. Do not share it with anyone.</p>
              <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">— The BikeMate Team</p>
            </div>
          `
        });
        emailSent = true;
      } catch (mailErr) {
        console.warn('⚠️ SMTP Email delivery warning:', mailErr.message);
        emailErrorMsg = mailErr.message;
      }
    }

    res.status(200).json({
      message: emailSent 
        ? `OTP sent to ${email}!` 
        : `OTP generated! Check terminal or use code: ${otp}`,
      devOtp: otp,
      emailSent
    });
  } catch (error) {
    console.error('OTP send error:', error.message);
    res.status(500).json({ message: 'Failed to generate OTP', error: error.message });
  }
};

// 4. Verify OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    // Allow master dev OTP '123456' in development mode
    if (process.env.NODE_ENV === 'development' && otp === '123456') {
      await OtpVerification.deleteMany({ email });
      return res.status(200).json({ message: 'Email verified successfully (dev bypass)', email });
    }
    
    const record = await OtpVerification.findOne({ email, otp });
    if (!record) return res.status(400).json({ message: 'Invalid or expired OTP' });
    
    if (record.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ message: 'OTP has expired' });
    }

    await OtpVerification.deleteOne({ _id: record._id });
    res.status(200).json({ message: 'Email verified successfully', email });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

// 5. Complete Registration
exports.setPassword = async (req, res) => {
  try {
    const { name, usn, college, phone, email, password, gender, department, idCardImageUrl, idCardHash } = req.body;
    
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    if (!password) return res.status(400).json({ message: 'Password is required' });

    // Validate password strength: min length 8, uppercase, lowercase, number, special char
    const hasMinLength = typeof password === 'string' && password.length >= 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    const missingRules = [];
    if (!hasMinLength) missingRules.push('at least 8 characters');
    if (!hasUpperCase) missingRules.push('at least one uppercase letter (A-Z)');
    if (!hasLowerCase) missingRules.push('at least one lowercase letter (a-z)');
    if (!hasNumber) missingRules.push('at least one number (0-9)');
    if (!hasSpecialChar) missingRules.push('at least one special character (!@#$%^&* etc.)');

    if (missingRules.length > 0) {
      return res.status(400).json({
        message: `Password does not meet security requirements. Missing: ${missingRules.join(', ')}.`,
        missingRules
      });
    }

    if (!name) return res.status(400).json({ message: 'Full name is required' });
    if (!email) return res.status(400).json({ message: 'Email address is required' });

    const phoneValidation = cleanAndValidateMobile(phone);
    if (!phoneValidation.valid) {
      return res.status(400).json({ message: phoneValidation.message });
    }
    const cleanPhone = phoneValidation.phone;
    const trimmedEmail = email.trim().toLowerCase();
    const userGender = (gender === 'female' || gender === 'ladies') ? 'female' : 'male';
    const finalDepartment = inferDepartment(department, usn);

    // Check for duplicates with clear error messages
    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({ message: `Mobile number ${cleanPhone} is already registered. Please login instead.` });
    }

    const existingEmail = await User.findOne({ email: trimmedEmail });
    if (existingEmail) {
      return res.status(400).json({ message: `Email ${trimmedEmail} is already registered. Please login instead.` });
    }

    if (usn && usn.trim()) {
      const trimmedUsn = usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
      const existingUsn = await User.findOne({
        $or: [
          { usn: trimmedUsn },
          { usn: { $regex: new RegExp(`^${trimmedUsn}$`, 'i') } },
          { 'ocrExtractedData.usn': trimmedUsn }
        ]
      });
      if (existingUsn) {
        return res.status(400).json({ message: `Not possible: USN ${trimmedUsn} is already registered with another account.` });
      }
    }

    if (idCardHash) {
      const existingCard = await User.findOne({ idCardHash });
      if (existingCard) {
        return res.status(400).json({ message: `Not possible: This ID card has already been registered (USN: ${existingCard.usn || 'registered student'}). Duplicate ID cards are not allowed.` });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: name.trim(),
      usn: (usn && usn.trim()) ? usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim() : `USN-${Date.now().toString().slice(-6)}`,
      college: (college && college.trim()) ? college.trim() : 'Ballari Institute of Technology and Management',
      department: finalDepartment,
      phone: cleanPhone,
      email: trimmedEmail,
      gender: userGender,
      passwordHash,
      password: passwordHash,
      password_hash: passwordHash,
      idCardImageUrl: idCardImageUrl || '',
      idCardHash: idCardHash || '',
      verificationStatus: 'verified',
      isVerified: true,
      role: 'student',
      homeLocation: {
        type: 'Point',
        coordinates: [76.9214, 15.1394]
      },
      ocrExtractedData: {
        name: name.trim(),
        usn: (usn && usn.trim()) ? usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim() : '',
        college: (college && college.trim()) ? college.trim() : '',
        department: finalDepartment
      }
    });


    res.status(201).json({ 
      message: 'Registration complete! You can now login.', 
      userId: newUser._id 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'detail';
      return res.status(400).json({ message: `This ${field} is already registered. Please login or use a different one.` });
    }
    res.status(400).json({ message: error.message || 'Registration failed' });
  }
};

// 6. Login
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ message: 'Phone and password are required' });
    }
    
    const user = await User.findOne({ phone: phone.trim() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials. Phone not found.' });

    const hash = user.passwordHash || user.password_hash || user.password;
    if (!hash) return res.status(400).json({ message: 'Account configuration error: no password hash found.' });

    const isMatch = await bcrypt.compare(password, hash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials. Incorrect password.' });

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// 7. Change Password
exports.changePassword = async (req, res) => {
  try {
    const { phone, currentPassword, newPassword } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    if (!newPassword) return res.status(400).json({ message: 'New password is required' });

    // Validate password strength: min length 8, uppercase, lowercase, number, special char
    const hasMinLength = typeof newPassword === 'string' && newPassword.length >= 8;
    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(newPassword);

    const missingRules = [];
    if (!hasMinLength) missingRules.push('at least 8 characters');
    if (!hasUpperCase) missingRules.push('at least one uppercase letter (A-Z)');
    if (!hasLowerCase) missingRules.push('at least one lowercase letter (a-z)');
    if (!hasNumber) missingRules.push('at least one number (0-9)');
    if (!hasSpecialChar) missingRules.push('at least one special character (!@#$%^&* etc.)');

    if (missingRules.length > 0) {
      return res.status(400).json({
        message: `New password does not meet security requirements. Missing: ${missingRules.join(', ')}.`,
        missingRules
      });
    }

    const user = await User.findOne({ phone: phone.trim() });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // If current password provided, verify it
    if (currentPassword) {
      const hash = user.passwordHash || user.password_hash || user.password;
      if (hash) {
        const isMatch = await bcrypt.compare(currentPassword, hash);
        if (!isMatch) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = passwordHash;
    user.password = passwordHash;
    user.password_hash = passwordHash;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
};

// 8. Update Profile (Name, Department, USN, College, Phone)
exports.updateProfile = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, college, department, phone, usn } = req.body;
    if (name && name.trim()) user.name = name.trim();
    if (college && college.trim()) user.college = college.trim();
    if (department && department.trim()) user.department = department.trim();
    if (phone && phone.trim()) user.phone = phone.trim();
    if (usn && usn.trim()) user.usn = usn.trim().toUpperCase();

    await user.save();
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};


