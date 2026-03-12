const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { name, email, phone, timeSlot } = req.body;

    if (!name || !email || !phone || !timeSlot) {
      return res.status(400).json({ error: "Missing required fields" });
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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});