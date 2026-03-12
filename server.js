const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

const allowedSlots = [
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM"
];

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.get("/available-slots", (req, res) => {
  res.json({ date: "March 29", slots: allowedSlots });
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { name, email, phone, timeSlot } = req.body;

    if (!name || !email || !phone || !timeSlot) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!allowedSlots.includes(timeSlot)) {
      return res.status(400).json({ error: "Invalid time slot selected" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Photo Day - 30 Minute Session"
            },
            unit_amount: 15000
          },
          quantity: 1
        }
      ],
      success_url: "https://www.tylerhenrystudio.com/success",
      cancel_url: "https://www.tylerhenrystudio.com/cancel",
      metadata: {
        name,
        email,
        phone,
        date: "March 29",
        timeSlot
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe error:", error.message);
    res.status(500).json({ error: "Checkout session failed" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});