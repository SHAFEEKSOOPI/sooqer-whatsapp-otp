const express = require("express");
const cors = require("cors");
const twilio = require("twilio");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   TWILIO CONFIG
   =============================== */
let client = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log("✅ Twilio client initialized");
} else {
  console.warn("⚠️ TWILIO credentials missing — WhatsApp OTP disabled");
}

const WHATSAPP_FROM = "whatsapp:+14155238886";

/* ===============================
   IN-MEMORY OTP STORE
   =============================== */
const otpStore = new Map();

/* ===============================
   SEND WHATSAPP OTP
   =============================== */
app.post("/api/send-whatsapp-otp", async (req, res) => {
  try {
    if (!client) {
      return res.status(503).json({
        success: false,
        message: "WhatsApp service not available"
      });
    }

    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number required"
      });
    }

    const existing = otpStore.get(phone);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore.set(phone, {
      otp,
      expires: Date.now() + 5 * 60 * 1000,
      attempts: 0,
      resendCount: existing ? existing.resendCount + 1 : 1
    });

    await client.messages.create({
      from: WHATSAPP_FROM,
      to: `whatsapp:${phone}`,
      body: `Your Sooqer OTP is ${otp}. Valid for 5 minutes.`
    });

    return res.json({ success: true });

  } catch (err) {
    console.error("❌ WhatsApp OTP error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

/* ===============================
   VERIFY WHATSAPP OTP
   =============================== */
app.post("/api/verify-whatsapp-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({
      success: false,
      message: "Phone and OTP required"
    });
  }

  const record = otpStore.get(phone);

  if (!record) {
    return res.json({ success: false, message: "OTP not found" });
  }

  if (Date.now() > record.expires) {
    otpStore.delete(phone);
    return res.json({ success: false, message: "OTP expired" });
  }

  if (record.attempts >= 5) {
    otpStore.delete(phone);
    return res.json({ success: false, message: "Too many attempts" });
  }

  record.attempts++;

  if (record.otp !== otp) {
    return res.json({ success: false, message: "Invalid OTP" });
  }

  otpStore.delete(phone);
  return res.json({ success: true });
});

/* ===============================
   START SERVER
   =============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ WhatsApp OTP server running on port ${PORT}`);
});
