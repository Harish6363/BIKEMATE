# BikeMate 🏍️🎒

> **Share Your Ride. Connect Your Campus.**  
> Official, verified peer-to-peer campus ride-sharing and carpooling platform built for college students.

---

## 🌟 Key Features

- **🎓 Verified Student Community**: 100% ID verification with Gemini-powered OCR and VTU USN validation to prevent duplicates and ensure safe campus travel.
- **🌸 Ladies-Safe Commute Mode**: Dedicated privacy and security mode enabling female students to match exclusively with verified female riders and drivers.
- **📍 Real-Time GPS Tracking & Live Radar**: Turn-by-turn OSRM routing with live telematics, arrival ETA, boarding PIN security, and driver contact.
- **💰 Fair-Share Campus Pricing**: Transparent micro-fare splitting (₹2/km petrol split), slashing daily travel expenses compared to auto-rickshaws.
- **🛡️ Campus Administrator Portal**: Live moderation dashboard with environmental telemetry (CO₂ saved, fuel conserved), real-time ride request oversight, user moderation, and audit logging.
- **💬 Real-Time In-App Messaging**: Socket.io powered instant chat between matched students.

---

## 🛠️ Tech Stack

- **Frontend**: React (Vite), TailwindCSS, Lucide Icons, Google Maps API / Leaflet, Socket.io-client, Axios
- **Backend**: Node.js, Express.js, MongoDB (Mongoose), Socket.io, JWT, Bcrypt
- **AI & Services**: Google Gemini API (ID Card OCR Extraction), Nodemailer (Campus OTP verification), Project OSRM (Turn-by-turn road routing)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB running locally on `mongodb://localhost:27017`

### 1. Clone the Repository
```bash
git clone https://github.com/Harish6363/BIKEMATE.git
cd BIKEMATE
```

### 2. Backend Setup
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory (reference `.env.example`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/bikemate
JWT_SECRET=your_secret_key
NODE_ENV=development
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
GEMINI_API_KEY=your_gemini_api_key
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
In a new terminal:
```bash
cd client
npm install
npm run dev
```

The application will be live at `http://localhost:5173`.

---

## 🛡️ Default Administrator Access
- **Admin Portal URL**: `http://localhost:5173/admin-login`
- **Username / Mobile**: `9999999999`
- **Password**: `password123`

---

## 📄 License
ISC License. Built for campus student communities.
