const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ApprovedStudent = require('../models/ApprovedStudent');

// List of all 35 students from details(name,usn,phone).csv
const defaultApprovedStudents = [
  { name: 'K Sriram', usn: '3BR23AI068', phoneNumber: '9380733014' },
  { name: 'Jayashree', usn: '3BR23AI059', phoneNumber: '8790294482' },
  { name: 'G Bhavya Chowdary', usn: '3BR23AI044', phoneNumber: '8618060145' },
  { name: 'P TEJA RANGA SAI', usn: '3BR23AI114', phoneNumber: '9880543024' },
  { name: 'Abhinaya Reddy', usn: '3BR23AI001', phoneNumber: '6363441819' },
  { name: 'Hampi Gayithri', usn: '3BR23AI054', phoneNumber: '9380015489' },
  { name: 'D Karthik', usn: '3BR23AI034', phoneNumber: '6361609996' },
  { name: 'BHARATH M', usn: '3BR23AI025', phoneNumber: '7993539002' },
  { name: 'GAJULA RAVIKIRAN', usn: '3BR23AI047', phoneNumber: '9538447749' },
  { name: 'Sneha', usn: '3BR23AI067', phoneNumber: '7204859189' },
  { name: 'Varshita', usn: '3BR23AI024', phoneNumber: '8762344569' },
  { name: 'K Vishal Vibu', usn: '3BR23AI072', phoneNumber: '7204114900' },
  { name: 'D Lavanya', usn: '3BR23AI036', phoneNumber: '8310357671' },
  { name: 'Joel', usn: '3BR23AI061', phoneNumber: '7483172638' },
  { name: 'D Karthikeya', usn: '3BR23AI035', phoneNumber: '8073976729' },
  { name: 'K S Nauman Ahmed', usn: '3BR23AI061', phoneNumber: '8147303789' },
  { name: 'Ashok B', usn: '3BR23AI014', phoneNumber: '9980715323' },
  { name: 'Akash K', usn: '3BR23AI007', phoneNumber: '7022561812' },
  { name: 'Jayavardhana A', usn: '3BR23AI060', phoneNumber: '7996995870' },
  { name: 'K Praveen', usn: '3BR23AI065', phoneNumber: '9741700289' },
  { name: 'Ayush Shetty', usn: '3BR23AI016', phoneNumber: '8310326764' },
  { name: 'CHARAN RAJ S', usn: '3BR23AI033', phoneNumber: '7975158898' },
  { name: 'Darshan Bandi', usn: '3BR23AI038', phoneNumber: '9019341016' },
  { name: 'Rohith Varma', usn: '3BR23AI135', phoneNumber: '8105498873' },
  { name: 'Dasari Keerthi', usn: '3BR23AI039', phoneNumber: '6366659981' },
  { name: 'Guru Prasad', usn: '3BR23AI051', phoneNumber: '8123067589' },
  { name: 'Gokarna T', usn: '3BR23AI050', phoneNumber: '8431262694' },
  { name: 'H Prashanth', usn: '3BR23AI057', phoneNumber: '8247500961' },
  { name: 'Ayushmaan Hansraj Singh', usn: '3BR23AI015', phoneNumber: '62002875316' },
  { name: 'Bhavani Hemagudda', usn: '3BR23AI026', phoneNumber: '9113866177' },
  { name: 'Ankita', usn: '3BR23AI011', phoneNumber: '6362590837' },
  { name: 'Dinesh Chowdary', usn: '3BR23AI020', phoneNumber: '6301991489' },
  { name: 'M Avinash', usn: '3BR23AI077', phoneNumber: '8825453772' },
  { name: 'B Prathyusha', usn: '3BR23AI021', phoneNumber: '8073411727' },
  { name: 'Harish C', usn: '3BR23AI056', phoneNumber: '6363828311' }
];

/**
 * Parses details(name,usn,phone).csv if it exists on disk
 */
function loadStudentsFromCsv() {
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'details(name,usn,phone).csv'),
    path.join(__dirname, '..', '..', '..', 'details(name,usn,phone).csv'),
    path.join(process.cwd(), 'details(name,usn,phone).csv')
  ];

  for (const csvPath of possiblePaths) {
    if (fs.existsSync(csvPath)) {
      try {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(s => s.trim());
          if (parts.length >= 3) {
            parsed.push({
              name: parts[0],
              usn: parts[1].toUpperCase(),
              phoneNumber: parts[2].replace(/[^0-9]/g, '')
            });
          }
        }
        if (parsed.length > 0) {
          console.log(`Loaded ${parsed.length} student records from CSV: ${csvPath}`);
          return parsed;
        }
      } catch (err) {
        console.warn(`Could not parse CSV at ${csvPath}:`, err.message);
      }
    }
  }

  return defaultApprovedStudents;
}

/**
 * Seeds or synchronizes the approved students collection
 */
async function seedApprovedStudents() {
  const students = loadStudentsFromCsv();
  console.log(`\n======================================================`);
  console.log(`🎓 [SEEDING APPROVED STUDENTS] Populating ${students.length} college records...`);

  let added = 0;
  let updated = 0;

  for (const item of students) {
    const cleanPhone = item.phoneNumber.trim();
    const cleanUsn = item.usn.trim().toUpperCase();
    const cleanName = item.name.trim();

    // Check if record exists by phone number (primary identifier in PDF/list)
    const existing = await ApprovedStudent.findOne({ phoneNumber: cleanPhone });

    if (!existing) {
      await ApprovedStudent.create({
        name: cleanName,
        usn: cleanUsn,
        phoneNumber: cleanPhone,
        college: 'Ballari Institute of Technology and Management',
        department: 'AIML',
        registrationStatus: 'not_registered',
        isRegistered: false
      });
      added++;
    } else {
      await ApprovedStudent.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: cleanName,
            usn: cleanUsn,
            phoneNumber: cleanPhone,
            college: 'Ballari Institute of Technology and Management',
            department: 'AIML',
            updatedAt: new Date()
          }
        }
      );
      updated++;
    }
  }

  console.log(`✅ Approved Students Synchronized: ${added} added, ${updated} verified/updated.`);
  console.log(`======================================================\n`);
  return { added, updated, total: students.length };
}

// Standalone execution support
if (require.main === module) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/bikemate';
  mongoose.connect(mongoUri)
    .then(async () => {
      await seedApprovedStudents();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to seed approved students:', err);
      process.exit(1);
    });
}

module.exports = { seedApprovedStudents, loadStudentsFromCsv, defaultApprovedStudents };
