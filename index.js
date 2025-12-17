// index.js
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// ======= Debug logs =======
console.log("Starting backend...");
console.log("PORT from .env:", process.env.PORT || 5000);
console.log("Razorpay Key ID loaded:", !!process.env.RAZORPAY_KEY_ID);

// ======= Middleware =======
app.use(cors());
app.use(express.json());

// ======= Razorpay instance =======
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ======= CREATE ORDER =======
app.post("/create-order", async (req, res) => {
  try {
    const { uid, plan } = req.body;

    if (!uid || !plan) {
      return res.status(400).json({ error: "Invalid request" });
    }

    let amount = 0;

    if (plan === "one_time") amount = 80;      // ₹80 per test
    else if (plan === "package") amount = 499; // ₹499 CPT package
    else return res.status(400).json({ error: "Invalid plan" });

    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects amount in paise
      currency: "INR",
      receipt: `${uid}_${Date.now()}`,
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

// ======= WEBHOOK =======
app.post("/razorpay-webhook", (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-razorpay-signature"];
  const body = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    console.log("Webhook signature mismatch!");
    return res.status(401).send("Invalid signature");
  }

  console.log("Payment verified via webhook:", req.body.event);
  // TODO: Update Firebase / database to unlock test/package for user

  res.sendStatus(200);
});

// ======= START SERVER =======
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});