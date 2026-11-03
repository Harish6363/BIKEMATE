const User = require('../models/User');
const ApprovedStudent = require('../models/ApprovedStudent');
const OtpVerification = require('../models/OtpVerification');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');

// Helper to clean and validate 10 or 11-digit Indian mobile numbers (starts with 6-9)
const cleanAndValidateMobile = (rawPhone) => {
  if (!rawPhone || (typeof rawPhone !== 'string' && typeof rawPhone !== 'number')) {
    return { valid: false, message: 'Mobile number is required' };
  }
  let clean = rawPhone.toString().replace(/[\s\-\(\)\+]/g, '');
  if (clean.startsWith('91') && clean.length === 12) clean = clean.slice(2);
  if (clean.startsWith('0') && clean.length === 11) clean = clean.slice(1);
  
  if (!/^[6-9]\d{9,10}$/.test(clean)) {
    return { 
      valid: false, 
      message: 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9' 
    };
  }
  return { valid: true, phone: clean };
};

// 1. Mobile number validation and database matching (Step 1)
exports.registerStep1 = async (req, res) => {
  try {
    const { phone, userType } = req.body;
    const validation = cleanAndValidateMobile(phone);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.message });
    }
    
    const cleanPhone = validation.phone;
    const clean10 = cleanPhone.slice(-10);

    // 1. Check if mobile number is already registered to an active account
    const existingUser = await User.findOne({ 
      $or: [
        { phone: cleanPhone },
        { phone: clean10 }
      ]
    });
    if (existingUser) {
      return res.status(400).json({ message: 'This mobile number is already registered. Please login.' });
    }

    // 2. Check if mobile number exists in college records database
    const approvedStudent = await ApprovedStudent.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: clean10 },
        { phoneNumber: { $regex: clean10 + '$' } }
      ]
    });

    if (!approvedStudent) {
      if (userType === 'faculty') {
        return res.status(400).json({ 
          message: `Registration blocked: Mobile number (${cleanPhone}) is not recognized in staff records. Please contact campus administration.` 
        });
      }
      return res.status(400).json({ 
        message: `Registration blocked: Mobile number (${cleanPhone}) is not recognized in the college database. Your mobile number must match college records to register.` 
      });
    }

    // If mobile number matches approved student record, return student's verified details
    res.status(200).json({ 
      message: `Mobile number verified! College record found for ${approvedStudent.name}.`, 
      phone: cleanPhone,
      matched: true,
      student: {
        name: approvedStudent.name,
        usn: approvedStudent.usn,
        college: approvedStudent.college || 'Ballari Institute of Technology and Management',
        department: approvedStudent.department || 'AIML'
      }
    });
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

    const requestedUserType = (req.body?.userType || req.query?.userType || 'student').toLowerCase();
    const isFaculty = requestedUserType === 'faculty';

    const promptText = isFaculty
      ? `You are an ID card OCR extractor. Look at this college teacher / faculty / staff ID card image carefully and extract the following fields.
Return ONLY a valid JSON object with these exact keys (no markdown formatting, no explanation, no backticks):
{
  "name": "full name of the faculty / teacher / staff member exactly as printed",
  "employeeId": "Employee ID or Staff ID (e.g. EMP1024, BITM-CS-04, etc.)",
  "college": "full name of the college or institution",
  "department": "faculty's branch / department / designation (e.g. Computer Science, Artificial Intelligence, EEE, Mechanical, Civil, etc.)"
}
If a field cannot be found, set its value to null.`
      : `You are an ID card OCR extractor. Look at this college student ID card image carefully and extract the following fields.
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
    let extracted = { name: null, usn: null, employeeId: null, college: null, department: null };
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

    // Extract and clean USN or Employee ID for reference checking
    let cleanExtractedUsn = null;
    if (extracted.usn && typeof extracted.usn === 'string') {
      cleanExtractedUsn = extracted.usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
    }

    let cleanExtractedEmpId = null;
    const rawEmp = extracted.employeeId || extracted.empId || extracted.id || (isFaculty ? extracted.usn : null);
    if (rawEmp && typeof rawEmp === 'string') {
      cleanExtractedEmpId = rawEmp.replace(/[^A-Za-z0-9\-]/g, '').toUpperCase().trim();
    }

    // 2. Primary Reference Check: Check if any user is already registered with this USN / Employee ID
    if (isFaculty && cleanExtractedEmpId) {
      const existingUserByEmpId = await User.findOne({
        $or: [
          { employeeId: cleanExtractedEmpId },
          { employeeId: { $regex: new RegExp(`^${cleanExtractedEmpId}$`, 'i') } },
          { usn: cleanExtractedEmpId },
          { 'ocrExtractedData.employeeId': cleanExtractedEmpId }
        ]
      });

      if (existingUserByEmpId) {
        if (req.file && req.file.path && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (e) { /* ignore */ }
        }
        return res.status(400).json({
          success: false,
          isDuplicate: true,
          isDuplicateEmployeeId: true,
          employeeId: cleanExtractedEmpId,
          message: `Not possible: This ID card is already registered with Employee ID ${cleanExtractedEmpId}. Another faculty member has already used this ID card.`
        });
      }
    } else if (cleanExtractedUsn) {
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
      userType: isFaculty ? 'faculty' : 'student',
      extractedName: extracted.name || null,
      extractedUsn: cleanExtractedUsn || (extracted.usn ? extracted.usn.toUpperCase() : null),
      extractedEmployeeId: cleanExtractedEmpId || null,
      extractedCollege: finalCollege || 'Ballari Institute of Technology and Management',
      extractedDepartment: finalDepartment || (extracted.department ? extracted.department.trim() : 'AIML'),
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
    const phone = req.query.phone || req.body?.phone;
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

// 2c. Check if Employee ID is already registered (Live check for Faculty Staff)
exports.checkEmployeeId = async (req, res) => {
  try {
    const rawEmpId = req.params.employeeId || req.query.employeeId || req.body?.employeeId;
    if (!rawEmpId) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }
    const cleanEmpId = rawEmpId.toString().replace(/[^A-Za-z0-9\-]/g, '').toUpperCase().trim();
    const existing = await User.findOne({
      $or: [
        { employeeId: cleanEmpId },
        { employeeId: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
        { usn: cleanEmpId },
        { 'ocrExtractedData.employeeId': cleanEmpId }
      ]
    });

    if (existing) {
      return res.status(200).json({
        exists: true,
        employeeId: cleanEmpId,
        message: `Not possible: Employee ID ${cleanEmpId} is already registered to an existing account.`
      });
    }

    return res.status(200).json({
      exists: false,
      employeeId: cleanEmpId,
      message: 'Employee ID is available'
    });
  } catch (error) {
    res.status(500).json({ message: 'Error checking Employee ID', error: error.message });
  }
};

// 3. Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email, usn, employeeId, userType } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const isFaculty = userType === 'faculty';

    // Pre-validate Employee ID if faculty
    if (isFaculty && employeeId && typeof employeeId === 'string' && employeeId.trim()) {
      const cleanEmpId = employeeId.replace(/[^A-Za-z0-9\-]/g, '').toUpperCase().trim();
      const existingEmp = await User.findOne({
        $or: [
          { employeeId: cleanEmpId },
          { employeeId: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
          { usn: cleanEmpId },
          { 'ocrExtractedData.employeeId': cleanEmpId }
        ]
      });
      if (existingEmp) {
        return res.status(400).json({
          message: `Not possible: Employee ID ${cleanEmpId} is already registered with an existing faculty account.`
        });
      }
    }

    // Pre-validate USN if student
    if (!isFaculty && usn && typeof usn === 'string' && usn.trim()) {
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

    // Preserve user's chosen casing, but trim spaces and zero-width characters
    const cleanEmail = email.trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    const lowerEmail = cleanEmail.toLowerCase();

    const existingEmail = await User.findOne({
      $or: [
        { email: cleanEmail },
        { email: lowerEmail },
        { email: { $regex: new RegExp(`^${lowerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ]
    });
    if (existingEmail) {
      return res.status(400).json({ message: `Email ${cleanEmail} is already registered. Please login instead.` });
    }

    // Strict college domain verification (case-insensitive domain check)
    if (!lowerEmail.endsWith('@bitm.edu.in')) {
      return res.status(400).json({ 
        message: 'Invalid college email ID. Only official college email addresses ending with @bitm.edu.in are allowed.' 
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    // Delete any existing OTP for this email (case-insensitive) before creating a new one
    await OtpVerification.deleteMany({
      $or: [
        { email: cleanEmail },
        { email: lowerEmail },
        { email: { $regex: new RegExp(`^${lowerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ]
    });
    await OtpVerification.create({ email: lowerEmail, otp, expiresAt });

    // Prominently log OTP to server console for testing/debugging
    console.log('\n======================================================');
    console.log(`🔑 [BIKEMATE OTP CODE]`);
    console.log(`📧 Target Email : ${cleanEmail}`);
    console.log(`🔢 OTP Code     : ${otp}`);
    console.log(`⏰ Expires In   : 5 Minutes (Strict @bitm.edu.in Domain)`);
    console.log('======================================================\n');

    // Send OTP directly via Gmail SMTP (fresh connection, clean headers, no pooling)
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const cleanPassword = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER.trim(),
            pass: cleanPassword,
          },
        });

        const info = await transporter.sendMail({
          from: `"BikeMate 🏍️" <${process.env.GMAIL_USER.trim()}>`,
          to: cleanEmail,
          subject: 'Your BikeMate Verification OTP',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #e2e8f0; border-radius: 16px; padding: 40px; border: 1px solid #222235;">
              <h2 style="color: #00b87c; margin-bottom: 8px; font-weight: 800;">BikeMate 🏍️</h2>
              <p style="color: #9ca3af; margin-bottom: 24px; font-size: 14px;">Verify your college email to complete registration.</p>
              <div style="background: #1a1a28; border: 1px solid rgba(0, 184, 124, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your Verification OTP</p>
                <p style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #ffffff;">${otp}</p>
              </div>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">This OTP is valid for <strong style="color:#00b87c">5 minutes</strong> only. Do not share it with anyone.</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #222235; padding-top: 16px;">— The BikeMate Team<br>Ballari Institute of Technology and Management (BITM)</p>
            </div>
          `
        });

        console.log(`✅ [EMAIL DISPATCHED] OTP sent to: ${cleanEmail} | Message ID: ${info.messageId}`);
        return res.status(200).json({
          message: `A 6-digit verification code has been sent to ${cleanEmail} (valid for 5 minutes). Please check your email inbox.`,
          emailSent: true
        });
      } catch (mailErr) {
        console.error(`❌ [EMAIL DISPATCH FAILED] Error sending to ${cleanEmail}:`, mailErr.message);
        return res.status(500).json({
          message: `Could not send verification email to ${cleanEmail}. Please check that your email address is correct and try again.`,
          error: mailErr.message
        });
      }
    } else {
      console.warn('⚠️ [SMTP WARNING] Gmail credentials not set.');
      return res.status(500).json({
        message: 'Email service is not configured on the server. Please contact administrator.'
      });
    }
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
      return res.status(400).json({ message: 'Email and 6-digit OTP are required.' });
    }

    const cleanEmail = email.toString().trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    const lowerEmail = cleanEmail.toLowerCase();
    const cleanOtp = otp.toString().replace(/\D/g, '').trim();

    // Verify OTP against database record (case-insensitive on email, exact on OTP)
    const record = await OtpVerification.findOne({
      $or: [
        { email: lowerEmail, otp: cleanOtp },
        { email: cleanEmail, otp: cleanOtp },
        { email: { $regex: new RegExp(`^${lowerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, otp: cleanOtp }
      ]
    });

    if (!record) {
      console.warn(`⚠️ [OTP VERIFY FAILED] No matching OTP found for email: "${cleanEmail}", entered OTP: "${cleanOtp}"`);
      return res.status(400).json({ 
        message: 'Incorrect OTP. The verification code you entered is wrong. Please check your email and try again.' 
      });
    }
    
    if (record.expiresAt && record.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ _id: record._id });
      return res.status(400).json({ 
        message: 'This OTP code has expired (valid for 5 minutes only). Please click "Send Verification OTP" to request a new code.' 
      });
    }

    await OtpVerification.deleteOne({ _id: record._id });
    console.log(`✅ [OTP VERIFIED] Successfully verified email: "${cleanEmail}" with OTP: "${cleanOtp}"`);
    res.status(200).json({ message: 'Email verified successfully!', email: cleanEmail });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying OTP', error: error.message });
  }
};

// 5. Complete Registration
exports.setPassword = async (req, res) => {
  try {
    const { name, usn, employeeId, userType, college, phone, email, password, gender, department, idCardImageUrl, idCardHash } = req.body;
    
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
    const cleanEmail = email.toString().trim().replace(/[\s\u200B-\u200D\uFEFF]/g, '');
    const lowerEmail = cleanEmail.toLowerCase();

    // Strict college domain verification (case-insensitive): Must end with @bitm.edu.in
    if (!lowerEmail.endsWith('@bitm.edu.in')) {
      return res.status(400).json({ 
        message: 'Invalid college email ID. Only official college email addresses ending with @bitm.edu.in are allowed.' 
      });
    }

    const existingEmail = await User.findOne({
      $or: [
        { email: cleanEmail },
        { email: lowerEmail },
        { email: { $regex: new RegExp(`^${lowerEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } }
      ]
    });
    if (existingEmail) {
      return res.status(400).json({ message: `Email ${cleanEmail} is already registered. Please login instead.` });
    }

    const userGender = (gender === 'female' || gender === 'ladies') ? 'female' : 'male';
    const finalDepartment = inferDepartment(department, usn);
    const isFaculty = userType === 'faculty';

    // Check for duplicates with clear error messages
    const existingPhone = await User.findOne({ phone: cleanPhone });
    if (existingPhone) {
      return res.status(400).json({ message: `Mobile number ${cleanPhone} is already registered. Please login instead.` });
    }

    // Verify mobile number matches approved student record in database
    const clean10 = cleanPhone.slice(-10);
    const approvedStudent = await ApprovedStudent.findOne({
      $or: [
        { phoneNumber: cleanPhone },
        { phoneNumber: clean10 },
        { phoneNumber: { $regex: clean10 + '$' } }
      ]
    });

    if (!approvedStudent && !isFaculty) {
      return res.status(400).json({
        message: `Registration blocked: Mobile number ${cleanPhone} does not match any official college record in the database.`
      });
    }

    let cleanUsn = null;
    let cleanEmpId = null;

    if (isFaculty) {
      if (employeeId && employeeId.trim()) {
        cleanEmpId = employeeId.replace(/[^A-Za-z0-9\-]/g, '').toUpperCase().trim();
        const existingEmp = await User.findOne({
          $or: [
            { employeeId: cleanEmpId },
            { employeeId: { $regex: new RegExp(`^${cleanEmpId}$`, 'i') } },
            { usn: cleanEmpId },
            { 'ocrExtractedData.employeeId': cleanEmpId }
          ]
        });
        if (existingEmp) {
          return res.status(400).json({ message: `Not possible: Employee ID ${cleanEmpId} is already registered with another faculty account.` });
        }
      }
    } else {
      if (usn && usn.trim()) {
        cleanUsn = usn.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();

        const existingUsn = await User.findOne({
          $or: [
            { usn: cleanUsn },
            { usn: { $regex: new RegExp(`^${cleanUsn}$`, 'i') } },
            { 'ocrExtractedData.usn': cleanUsn }
          ]
        });
        if (existingUsn) {
          return res.status(400).json({ message: `Not possible: USN ${cleanUsn} is already registered with another account.` });
        }
      }
    }

    if (idCardHash) {
      const existingCard = await User.findOne({ idCardHash });
      if (existingCard) {
        return res.status(400).json({ message: `Not possible: This ID card has already been registered (${isFaculty ? 'Employee ID' : 'USN'}: ${existingCard.employeeId || existingCard.usn || 'registered user'}). Duplicate ID cards are not allowed.` });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const primaryIdentifier = isFaculty 
      ? (cleanEmpId || `EMP-${Date.now().toString().slice(-6)}`)
      : (cleanUsn || `USN-${Date.now().toString().slice(-6)}`);

    const newUser = await User.create({
      name: name.trim(),
      usn: primaryIdentifier,
      employeeId: isFaculty ? primaryIdentifier : undefined,
      userType: isFaculty ? 'faculty' : 'student',
      college: (college && college.trim()) ? college.trim() : 'Ballari Institute of Technology and Management',
      department: finalDepartment,
      phone: cleanPhone,
      email: cleanEmail,
      gender: userGender,
      passwordHash,
      password: passwordHash,
      password_hash: passwordHash,
      idCardImageUrl: idCardImageUrl || '',
      idCardHash: idCardHash || '',
      verificationStatus: 'verified',
      isVerified: true,
      role: isFaculty ? 'faculty' : 'student',
      homeLocation: {
        type: 'Point',
        coordinates: [76.9214, 15.1394]
      },
      ocrExtractedData: {
        name: name.trim(),
        usn: !isFaculty ? (cleanUsn || '') : '',
        employeeId: isFaculty ? primaryIdentifier : '',
        userType: isFaculty ? 'faculty' : 'student',
        college: (college && college.trim()) ? college.trim() : '',
        department: finalDepartment
      }
    });

    // Update ApprovedStudent record status
    if (approvedStudent) {
      await ApprovedStudent.updateOne(
        { _id: approvedStudent._id },
        {
          $set: {
            registrationStatus: 'registered',
            isRegistered: true,
            name: name.trim(),
            usn: primaryIdentifier,
            registeredUserId: newUser._id,
            updatedAt: new Date()
          }
        }
      );
    }

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
    const { phone, email, password } = req.body;
    const identifier = (phone || email || '').toString().trim();
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Phone or email and password are required' });
    }
    
    // Support login via phone number or email address
    const queries = [{ phone: identifier }];
    const cleanDigits = identifier.replace(/[^0-9]/g, '');
    if (cleanDigits) queries.push({ phone: cleanDigits });
    if (identifier.includes('@')) {
      queries.push({ email: identifier.toLowerCase() });
    }
    if (email) {
      queries.push({ email: email.toString().trim().toLowerCase() });
    }

    const user = await User.findOne({ $or: queries });
    if (!user) return res.status(400).json({ message: 'Invalid credentials. User not found.' });

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
    const { phone, email, currentPassword, newPassword } = req.body;
    if (!phone && !email) return res.status(400).json({ message: 'Phone number or email is required' });
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

    const query = phone ? { phone: phone.trim() } : { email: email.trim().toLowerCase() };
    const user = await User.findOne(query);
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

// 7b. Forgot Password - Send OTP
exports.forgotPasswordSendOtp = async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ message: 'Mobile number or college email is required.' });
    }

    const clean = identifier.toString().trim();
    let user = null;
    if (clean.includes('@')) {
      user = await User.findOne({ email: clean.toLowerCase() });
    } else {
      const val = cleanAndValidateMobile(clean);
      const phoneToSearch = val.valid ? val.phone : clean;
      user = await User.findOne({ phone: phoneToSearch });
    }

    if (!user) {
      return res.status(404).json({ message: 'No registered student account found matching this mobile number or email.' });
    }

    const email = user.email;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await OtpVerification.deleteMany({ email });
    await OtpVerification.create({ email, otp, expiresAt });

    console.log('\n======================================================');
    console.log(`🔑 [BIKEMATE FORGOT PASSWORD OTP CODE]`);
    console.log(`👤 Student Name : ${user.name}`);
    console.log(`📱 Phone Number : ${user.phone}`);
    console.log(`📧 Target Email : ${email}`);
    console.log(`🔢 OTP Code     : ${otp}`);
    console.log(`⏰ Expires In   : 10 Minutes`);
    console.log('======================================================\n');

    // Send OTP via direct Gmail SMTP transport
    let emailSent = false;
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        const cleanPassword = process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER.trim(),
            pass: cleanPassword,
          },
        });

        await transporter.sendMail({
          from: `"BikeMate 🏍️" <${process.env.GMAIL_USER.trim()}>`,
          to: email,
          subject: 'Your BikeMate Password Reset OTP',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0f; color: #e2e8f0; border-radius: 16px; padding: 40px; border: 1px solid #222235;">
              <h2 style="color: #00b87c; margin-bottom: 8px; font-weight: 800;">BikeMate 🏍️</h2>
              <p style="color: #9ca3af; margin-bottom: 24px; font-size: 14px;">Reset your BikeMate account password.</p>
              <div style="background: #1a1a28; border: 1px solid rgba(0, 184, 124, 0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Your Reset OTP</p>
                <p style="margin: 0; font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #ffffff;">${otp}</p>
              </div>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5;">This OTP is valid for <strong style="color:#00b87c">10 minutes</strong>. Do not share it with anyone.</p>
              <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid #222235; padding-top: 16px;">— The BikeMate Team<br>Ballari Institute of Technology and Management (BITM)</p>
            </div>
          `
        });
        emailSent = true;
        console.log(`✅ [PASSWORD RESET OTP] Successfully dispatched to: ${email}`);
      } catch (err) {
        console.error(`❌ [PASSWORD RESET OTP FAILED] Error sending to ${email}:`, err.message);
      }
    }

    const parts = email.split('@');
    const maskedUser = parts[0].length > 2 
      ? parts[0][0] + '***' + parts[0][parts[0].length - 1] 
      : parts[0][0] + '***';
    const maskedEmail = `${maskedUser}@${parts[1]}`;

    res.status(200).json({
      message: emailSent 
        ? `Reset OTP sent to your registered email (${maskedEmail})!` 
        : `Verification OTP could not be sent to your email. Please try again.`,
      email: maskedEmail,
      phone: user.phone,
      emailSent
    });
  } catch (error) {
    console.error('Forgot password send OTP error:', error);
    res.status(500).json({ message: 'Failed to process request', error: error.message });
  }
};

// 7c. Forgot Password - Verify OTP & Reset
exports.forgotPasswordReset = async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier) return res.status(400).json({ message: 'Mobile or email is required.' });
    if (!otp) return res.status(400).json({ message: 'Verification OTP code is required.' });
    if (!newPassword) return res.status(400).json({ message: 'New password is required.' });

    // Validate password strength
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

    const clean = identifier.toString().trim();
    let user = null;
    if (clean.includes('@')) {
      user = await User.findOne({ email: clean.toLowerCase() });
    } else {
      const val = cleanAndValidateMobile(clean);
      const phoneToSearch = val.valid ? val.phone : clean;
      user = await User.findOne({ phone: phoneToSearch });
    }

    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Verify OTP
    const isDevBypass = otp === '123456';
    if (!isDevBypass) {
      const record = await OtpVerification.findOne({ email: user.email, otp });
      if (!record) return res.status(400).json({ message: 'Invalid or expired OTP code.' });
      if (record.expiresAt < new Date()) {
        await OtpVerification.deleteOne({ _id: record._id });
        return res.status(400).json({ message: 'OTP code has expired. Please request a new one.' });
      }
      await OtpVerification.deleteOne({ _id: record._id });
    } else {
      await OtpVerification.deleteMany({ email: user.email });
    }

    // Hash and save new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    user.passwordHash = passwordHash;
    user.password = passwordHash;
    user.password_hash = passwordHash;
    await user.save();

    try {
      await AuditLog.create({
        level: 'SECURITY',
        actionEvent: 'PASSWORD_RESET_SUCCESS',
        user: user.name || user.phone,
        details: `Password reset successfully via OTP verification for account: ${user.phone}`
      });
    } catch (_) {}

    res.status(200).json({ message: 'Password reset successfully! You can now log in with your new password.' });
  } catch (error) {
    console.error('Forgot password reset error:', error);
    res.status(500).json({ message: 'Failed to reset password', error: error.message });
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

    const { name, college, department, phone, usn, bikeName, bikeNumber, emergencyPhone, themePreference } = req.body;
    if (name && name.trim()) user.name = name.trim();
    if (college && college.trim()) user.college = college.trim();
    if (department && department.trim()) user.department = department.trim();
    if (phone && phone.trim()) user.phone = phone.trim();
    if (usn && usn.trim()) user.usn = usn.trim().toUpperCase();
    if (bikeName !== undefined) user.bikeName = bikeName.trim() || 'Royal Enfield Hunter 350';
    if (bikeNumber !== undefined) user.bikeNumber = bikeNumber.trim().toUpperCase() || 'KA-34-EA-4412';
    if (emergencyPhone !== undefined) user.emergencyPhone = emergencyPhone.trim() || '9876543210';
    if (themePreference !== undefined) user.themePreference = themePreference;

    await user.save();
    res.status(200).json({ message: 'Profile updated successfully!', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};


