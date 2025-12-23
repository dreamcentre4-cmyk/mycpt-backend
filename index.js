const { admin, db } = require("./firebaseAdmin");
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

/**
 * ⚠️ IMPORTANT:
 * Razorpay webhook MUST use raw body
 * and MUST be declared BEFORE express.json()
 */
app.post(
  "/razorpay-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body.toString();

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.log("❌ Webhook signature mismatch");
      return res.status(401).send("Invalid signature");
    }

    const event = JSON.parse(body);
    console.log("✅ Webhook verified:", event.event);

    res.sendStatus(200);
  }
);

// AFTER webhook
app.use(express.json());
app.use(cors());

// ===== DEBUG (SAFE TO REMOVE LATER) =====
console.log("KEY ID:", process.env.RAZORPAY_KEY_ID ? "OK" : "MISSING");
console.log("KEY SECRET:", process.env.RAZORPAY_KEY_SECRET ? "OK" : "MISSING");
console.log(
  "WEBHOOK SECRET:",
  process.env.RAZORPAY_WEBHOOK_SECRET ? "OK" : "MISSING"
);

// ===== Razorpay instance =====
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ===== CREATE ORDER =====
app.post("/create-order", async (req, res) => {
  try {
    const { uid, plan } = req.body;

    if (!uid || !plan) {
      return res.status(400).json({ error: "Invalid request" });
    }

    let amount;
    if (plan === "one_time") amount = 80;
    else if (plan === "package") amount = 499;
    else return res.status(400).json({ error: "Invalid plan" });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `cpt_${Date.now().toString().slice(-8)}`,
      notes: { uid, plan },
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("❌ Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
