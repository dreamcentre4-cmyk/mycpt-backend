const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// ===== Middleware =====
app.use(cors());

// JSON parsing for normal routes
app.use(express.json());

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

    let amount = 0;
    if (plan === "one_time") amount = 80;
    else if (plan === "package") amount = 499;
    else return res.status(400).json({ error: "Invalid plan" });

    const order = await razorpay.orders.create({
      amount: amount * 100, // paise
      currency: "INR",
      receipt: `${uid}_${Date.now()}`,
      notes: { uid, plan }, // IMPORTANT for webhook
    });

    res.json({
      orderId: order.id,
      amount,
      currency: "INR",
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

// ===== RAZORPAY WEBHOOK =====
// Must use raw body (NOT express.json)
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
      console.log("Webhook signature mismatch!");
      return res.status(401).send("Invalid signature");
    }

    const webhookData = JSON.parse(body);
    console.log("Payment verified:", webhookData.event);

    // 👉 Later: update Firebase here using:
    // webhookData.payload.payment.entity.notes.uid
    // webhookData.payload.payment.entity.notes.plan

    res.sendStatus(200);
  }
);

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});