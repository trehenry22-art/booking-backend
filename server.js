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

// IMPORTANT: webhook route must come before express.json()
app.post("/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId) {
        await supabase
          .from("bookings")
          .update({ payment_status: "paid" })
          .eq("id", bookingId);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;

      if (bookingId) {
        await supabase
          .from("bookings")
          .delete()
          .eq("id", bookingId);
      }
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error.message);
    return res.status(500).json({ error: "Webhook handling failed" });
  }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is working!");
});

app.get("/available-slots", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("time_slot")
      .eq("booking_date", BOOKING_DATE)
      .eq("payment_status", "paid");

    if (error) {
      throw error;
    }

    const takenSlots = (data || []).map((b) => b.time_slot);

    const openSlots = ALL_SLOTS.filter(
      (slot) => !takenSlots.includes(slot)
    );

    return res.json({
      date: BOOKING_DATE,
      slots: openSlots
    });
  } catch (error) {
    console.error("Available slots error:", error.message);
    return res.status(500).json({ error: "Could not load slots" });
  }
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const { name, email, phone, timeSlot } = req.body;

    if (!name || !email || !phone || !timeSlot) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const { data: existing, error: existingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_date", BOOKING_DATE)
      .eq("time_slot", timeSlot)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      return res.status(400).json({
        error: "That slot has already been booked."
      });
    }

    const { data: booking, error: bookingError } = await supabase
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

    if (bookingError) {
      throw bookingError;
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
              name: `Photo Day Session ${timeSlot}`
            },
            unit_amount: 15000
          },
          quantity: 1
        }
      ],
      success_url: "https://www.tylerhenrystudio.com/photoday26?success=true",
      cancel_url: "https://www.tylerhenrystudio.com/photoday26?canceled=true",
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

    return res.json({
      url: session.url
    });
  } catch (error) {
    console.error("Checkout session error:", error.message);
    return res.status(500).json({ error: "Checkout failed" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
add stripe webhook
