const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PORT = process.env.PORT || 3000;

const BOOKING_DATE = "March 29";

const ALL_SLOTS = [
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

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.get("/available-slots", async (req, res) => {

  const { data } = await supabase
    .from("bookings")
    .select("time_slot")
    .eq("booking_date", BOOKING_DATE)
    .eq("payment_status", "paid");

  const takenSlots = data.map(b => b.time_slot);

  const openSlots = ALL_SLOTS.filter(
    slot => !takenSlots.includes(slot)
  );

  res.json({
    date: BOOKING_DATE,
    slots: openSlots
  });

});

app.post("/create-checkout-session", async (req, res) => {

  const { name, email, phone, timeSlot } = req.body;

  const { data: existing } = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_date", BOOKING_DATE)
    .eq("time_slot", timeSlot)
    .maybeSingle();

  if (existing) {
    return res.status(400).json({
      error: "That slot has already been booked."
    });
  }

  const { data: booking } = await supabase
    .from("bookings")
    .insert({
      booking_date: BOOKING_DATE,
      time_slot: timeSlot,
      client_name: name,
      client_email: email,
      client_phone: phone,
      payment_status: "pending"
    })
    .select()
    .single();

  const session = await stripe.checkout.sessions.create({

    payment_method_types: ["card"],

    mode: "payment",

    customer_email: email,

    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Photo Day Session ${timeSlot}`
          },
          unit_amount: 15000
        },
        quantity: 1
      }
    ],

    success_url:
      "https://www.tylerhenrystudio.com/success",

    cancel_url:
      "https://www.tylerhenrystudio.com/cancel",

    metadata: {
      bookingId: booking.id
    }

  });

  await supabase
    .from("bookings")
    .update({
      stripe_session_id: session.id
    })
    .eq("id", booking.id);

  res.json({
    url: session.url
  });

});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
