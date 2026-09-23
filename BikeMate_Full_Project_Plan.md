# BikeMate — Full Project Build Plan

## 1. Project Overview

**Purpose:** Connect students from the same college who travel similar routes to/from campus, so they can share rides (rider pays the ride provider).

**Core user flow:** Register (with ID card verification) → Login → Offer a Ride or Find a Ride → Match with nearby students → Chat → Ride happens.

**Trust model:** Every user must be verified as belonging to the same college via ID card OCR + college email OTP. This is the safety backbone of the whole app — don't skip or weaken it.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Tailwind CSS | Matches the clean card-based UI already mocked up |
| Maps | Google Maps JavaScript API (Places, Directions, Distance Matrix) | Best India coverage; alt: Leaflet + OpenStreetMap (free, no billing) |
| Backend | Node.js + Express | Fast to build, huge ecosystem, pairs naturally with MongoDB |
| Database | **MongoDB** (Atlas for hosting) | Flexible schema for evolving ride/match data; `2dsphere` geospatial index handles route matching |
| Cache / OTP store | Redis | Short-TTL OTP storage, live notification queueing |
| Real-time | Socket.io | Chat (Messages tab) + live ride-match notifications |
| OCR | Tesseract.js (free, client or server) or Google Cloud Vision API (more accurate, paid) | Extract Name/USN/College from ID card image |
| Auth | JWT (access + refresh tokens) | Stateless auth for phone+password login |
| Password hashing | bcrypt (cost factor 10–12) or argon2 | Never store plaintext |
| Email (OTP) | Nodemailer + Gmail SMTP, or Resend/SendGrid | OTP delivery to college Gmail |
| File storage | Cloudinary or AWS S3 | Store uploaded ID card images |
| Hosting | Backend: Render/Railway. Frontend: Vercel/Netlify. DB: MongoDB Atlas free tier | Free-tier friendly for a student project |

---

## 3. Folder Structure

```
bikemate/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/             # Home, MyRides, Messages, Notifications, Profile, Settings
│   │   ├── components/
│   │   ├── context/            # Auth context
│   │   ├── services/            # API call wrappers (axios)
│   │   └── App.jsx
│   └── package.json
│
├── server/                    # Node/Express backend
│   ├── models/                 # User.js, Ride.js, RideRequest.js, Message.js
│   ├── routes/                 # auth.js, users.js, rides.js, messages.js
│   ├── controllers/
│   ├── middleware/             # auth.js (JWT verify), upload.js (multer)
│   ├── services/               # ocrService.js, otpService.js, matchService.js
│   ├── config/                 # db.js, cloudinary.js
│   ├── server.js
│   └── package.json
│
└── README.md
```

---

## 4. Database Schema (MongoDB / Mongoose)

### `User`
```js
{
  name: String,
  usn: { type: String, unique: true },
  college: String,             // must match verified college
  department: String,
  phone: { type: String, unique: true },
  email: { type: String, unique: true },     // must be @college-domain
  passwordHash: String,
  idCardImageUrl: String,
  ocrExtractedData: { name: String, usn: String, college: String }, // raw OCR output, for audit
  verificationStatus: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
  homeLocation: { type: { type: String, default: "Point" }, coordinates: [Number] }, // [lng, lat]
  createdAt: Date
}
```

### `Ride`
```js
{
  offeredBy: { type: ObjectId, ref: "User" },
  origin: { type: { type: String, default: "Point" }, coordinates: [Number] },
  destination: { type: { type: String, default: "Point" }, coordinates: [Number] },
  routePolyline: String,        // encoded polyline from Directions API
  departureTime: Date,
  seatsAvailable: Number,
  pricePerSeat: Number,
  status: { type: String, enum: ["active", "full", "completed", "cancelled"], default: "active" },
  createdAt: Date
}
// Index: rides.index({ origin: "2dsphere" }); rides.index({ destination: "2dsphere" });
```

### `RideRequest`
```js
{
  ride: { type: ObjectId, ref: "Ride" },
  requester: { type: ObjectId, ref: "User" },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  createdAt: Date
}
```

### `Message`
```js
{
  ride: { type: ObjectId, ref: "Ride" },
  sender: { type: ObjectId, ref: "User" },
  receiver: { type: ObjectId, ref: "User" },
  content: String,
  sentAt: Date
}
```

### `OtpVerification` (or use Redis instead of a collection)
```js
{ email: String, otpHash: String, expiresAt: Date }
```

---

## 5. Registration Flow — Step by Step

1. **Phone number entry** — validate 10-digit format, check uniqueness.
2. **ID card upload**
   - User uploads image (multer → Cloudinary/S3).
   - Send image to OCR service → extract raw text → parse Name, USN, College Name (regex + heuristics, since ID card layouts vary).
   - User also types Name/USN/College into form fields.
   - **Fuzzy-match** typed input vs OCR output (Levenshtein distance / `string-similarity` npm package). If similarity is high → auto-approve. If low → flag for manual review, don't hard-block (OCR isn't perfect).
3. **College Gmail + OTP**
   - Enforce college email domain (e.g. `@bitm.edu.in`) at input validation — reject other domains immediately.
   - Generate 6-digit OTP, store in Redis with 5–10 min TTL keyed by email.
   - Send OTP via Nodemailer.
   - Verify OTP on submit; delete from Redis once used or expired.
4. **Password creation**
   - Enforce minimum strength (length, mix of chars).
   - Hash with bcrypt before saving — never log or store plaintext.
5. **Complete registration** — create `User` doc with `verificationStatus: "verified"` (or "pending" if OCR flagged), redirect to login.

---

## 6. Login Flow

1. Phone + password submitted.
2. Look up user by phone.
3. `bcrypt.compare(inputPassword, user.passwordHash)`.
4. On success, issue JWT (short-lived access token + longer-lived refresh token).
5. Redirect to dashboard; store token client-side (httpOnly cookie preferred over localStorage for security).

---

## 7. Ride Matching Logic (MongoDB Geospatial)

1. Both origin and destination are stored as GeoJSON `Point`s with `2dsphere` indexes.
2. To find candidate matches for a "Find a Ride" request:
```js
Ride.find({
  origin: {
    $near: {
      $geometry: { type: "Point", coordinates: [requesterLng, requesterLat] },
      $maxDistance: 1000 // meters — tune this radius
    }
  },
  destination: {
    $near: {
      $geometry: { type: "Point", coordinates: [collegeLng, collegeLat] },
      $maxDistance: 1000
    }
  },
  status: "active"
})
```
3. For better precision than endpoint-only matching, optionally compare route polylines (buffer/corridor check) so two people whose start points are close but who take very different paths aren't matched. This is a v2 enhancement — start with endpoint proximity.
4. Rank results by distance + departure time proximity.

---

## 8. Real-Time Features (Socket.io)

- **Chat:** Once a `RideRequest` is accepted, open a socket room keyed by `rideId` or a combined user-pair ID. Persist messages to MongoDB, emit live.
- **Live match alerts:** When a new `Ride` is posted, check for existing pending requests nearby (or notify online users whose saved home location matches) and push a notification via socket + store in a `Notification` collection.

---

## 9. API Endpoint List (starting point)

```
POST   /api/auth/register/step1        - phone
POST   /api/auth/register/upload-id    - ID card image + OCR
POST   /api/auth/register/send-otp     - send OTP to college email
POST   /api/auth/register/verify-otp
POST   /api/auth/register/set-password - complete registration
POST   /api/auth/login

GET    /api/rides                      - list/search rides (with geo filters)
POST   /api/rides                      - offer a ride
GET    /api/rides/:id
POST   /api/rides/:id/request          - request to join a ride
PATCH  /api/rides/:id/requests/:reqId  - accept/reject a request

GET    /api/messages/:rideId
POST   /api/messages/:rideId

GET    /api/notifications
PATCH  /api/notifications/clear

GET    /api/users/me
PATCH  /api/users/me/settings
```

---

## 10. Build Order (recommended sequence)

1. Set up MongoDB Atlas cluster + Express server skeleton + `.env` config.
2. Build `User` model + registration flow (phone → OCR upload → OTP → password) end to end, test with Postman before touching frontend.
3. Build login + JWT middleware.
4. Build React frontend shell matching your existing mockups (Home, My Rides, Messages, Notifications, Profile, Settings) and wire up auth screens.
5. Build `Ride` model + create/list ride endpoints (no geo yet — flat list first).
6. Add `2dsphere` indexes and geo-matching queries.
7. Integrate Google Maps (Places autocomplete for pickup, Directions for route display).
8. Add Socket.io for chat + notifications.
9. Add ride request/accept flow connecting matching → chat.
10. Polish: profile edit, settings toggles, verification badge logic, error states, loading states.
11. Deploy (Atlas + Render/Railway + Vercel), test on real devices.

---

## 11. Security Checklist

- [ ] Passwords hashed with bcrypt/argon2, never logged
- [ ] JWT secrets in `.env`, never committed
- [ ] College email domain enforced server-side, not just client-side
- [ ] OTP stored hashed in Redis with short TTL, rate-limited (max attempts)
- [ ] ID card images stored securely, access-controlled (not public URLs if avoidable)
- [ ] Input validation/sanitization on all endpoints (express-validator)
- [ ] Rate limiting on auth endpoints (express-rate-limit)
- [ ] CORS configured to only allow your frontend origin
- [ ] HTTPS enforced in production

---

## 12. Handoff Notes for Any AI Picking This Up

- This is an MVP-focused plan — v1 should prioritize registration integrity and basic ride matching over polish.
- MongoDB was chosen over PostgreSQL for schema flexibility during early iteration; geospatial matching is fully supported via `2dsphere` indexes, so this is not a limiting factor.
- OCR accuracy will be imperfect — always build a manual-review fallback rather than hard-blocking registration on OCR mismatch.
- Route-matching starts as simple endpoint-proximity (`$near`), with polyline/corridor comparison as a documented future enhancement, not a v1 requirement.
