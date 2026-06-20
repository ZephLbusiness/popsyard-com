const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const db = require("./db");
const stripe = require("./stripe");
const calendar = require("./calendar");
const twilio = require("./twilio");

const app = express();
const PORT = process.env.PORT || 3456;
const DATA_DIR = path.join(__dirname, "data");
const PHOTOS_DIR = path.join(__dirname, "sent-photos");
const CONFIG_PATH = path.join(__dirname, "email-config.json");
const BOOKINGS_FILE = path.join(DATA_DIR, "bookings.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const ok = ["image/jpeg", "image/png", "image/webp"]; ok.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPG/PNG/WebP allowed")); } });

app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/photos", express.static(PHOTOS_DIR));
app.use((req, res, next) => {
  if (req.path.startsWith("/data/") || req.path.startsWith("/sent-photos/") || req.path.startsWith("/node_modules/") || req.path === "/.env") {
    return res.status(403).send("Forbidden");
  }
  next();
});
app.use(express.static(__dirname));

function readJson(file) {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return [];
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return []; }
}
function writeJson(file, data) {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2));
}

function loadConfig() {
  const env = process.env;
  if (env.SMTP_USER && env.SMTP_PASS && env.SMTP_USER !== "placeholder") {
    return {
      notifyEmail: env.NOTIFY_EMAIL || "Zeph@survivormountain.com",
      smtp: { host: env.SMTP_HOST || "smtp.gmail.com", port: parseInt(env.SMTP_PORT) || 587, secure: env.SMTP_SECURE === "true", user: env.SMTP_USER, pass: env.SMTP_PASS },
    };
  }
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { return null; }
}

async function sendEmail(to, subject, html, attachments) {
  const config = loadConfig();
  if (!config || !config.smtp || !config.smtp.user || config.smtp.user === "YOUR_EMAIL@gmail.com") {
    console.log(`Email not sent (not configured): ${subject} -> ${to}`);
    return false;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
    const mail = { from: `"popsyard.com" <${config.smtp.user}>`, to, subject, html };
    if (attachments) mail.attachments = attachments;
    await transporter.sendMail(mail);
    console.log(`Email sent to ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error("Email send failed:", err.message);
    return false;
  }
}

function loadBookings() {
  if (!fs.existsSync(BOOKINGS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(BOOKINGS_FILE, "utf8")); } catch { return {}; }
}
function saveBookings(data) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2));
}

app.post("/api/notify-order", async (req, res) => {
  const { name, phone, email, address, dogs, plan, notes } = req.body;
  const config = loadConfig();
  const notifyTo = config ? config.notifyEmail : "Zeph@survivormountain.com";

  const adminHtml = `<h2>New Order Received</h2><table style="border-collapse:collapse;width:100%"><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Name</td><td style="padding:8px;border:1px solid #ccc">${name}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Phone</td><td style="padding:8px;border:1px solid #ccc">${phone}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Email</td><td style="padding:8px;border:1px solid #ccc">${email || "—"}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Address</td><td style="padding:8px;border:1px solid #ccc">${address}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Dogs</td><td style="padding:8px;border:1px solid #ccc">${dogs}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Plan</td><td style="padding:8px;border:1px solid #ccc">${plan}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Notes</td><td style="padding:8px;border:1px solid #ccc">${notes || "—"}</td></tr></table><p style="margin-top:16px;color:#888">Log into the admin panel to view details and contact the customer.</p>`;
  const adminSent = await sendEmail(notifyTo, "New Yard Care Order", adminHtml);

  let customerSent = false;
  if (email) {
    const customerHtml = `<h2>Thank you for your order!</h2><p>Hi ${name},</p><p>We've received your yard care request for <strong>${address}</strong> and will be in touch soon to confirm your first visit.</p><table style="border-collapse:collapse;width:100%;max-width:400px"><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Plan</td><td style="padding:8px;border:1px solid #ccc">${plan}</td></tr><tr><td style="padding:8px;border:1px solid #ccc;font-weight:700">Address</td><td style="padding:8px;border:1px solid #ccc">${address}</td></tr></table><p style="margin-top:16px">If you have any questions, just reply to this email.</p><p style="color:#888">- Zeph, popsyard.com</p>`;
    customerSent = await sendEmail(email, "Order Confirmed — popsyard.com", customerHtml);
  }

  res.json({ success: true, emailSent: adminSent, customerEmailSent: customerSent });
});

app.post("/api/send-photo", upload.single("photo"), async (req, res) => {
  const { customerEmail, customerName, seniorEmail, message } = req.body;
  const file = req.file;
  if (!file || !customerEmail) return res.status(400).json({ error: "Photo and customer email required" });
  const greeting = customerName ? `<p>Hi ${customerName},</p>` : "";
  const html = `<h2>Visit Update from popsyard.com</h2>${greeting}${message ? `<p>${message}</p>` : ""}<p>Here's a photo from today's visit:</p><img src="cid:visit-photo" style="max-width:100%;border-radius:8px" /><p style="margin-top:16px;color:#888">Your popsyard.com team</p>`;
  const attachment = { filename: file.originalname, path: file.path, cid: "visit-photo" };
  const sent = await sendEmail(customerEmail, "Yard Care Visit Update", html, [attachment]);
  let seniorSent = false;
  if (seniorEmail && seniorEmail !== customerEmail) {
    const seniorHtml = `<h2>Visit Update from popsyard.com</h2><p>All finished with the yard for today!</p>${message ? `<p>${message}</p>` : ""}<img src="cid:visit-photo" style="max-width:100%;border-radius:8px" /><p style="margin-top:16px;color:#888">Your popsyard.com team</p>`;
    seniorSent = await sendEmail(seniorEmail, "Your Yard Care Visit", seniorHtml, [attachment]);
  }
  res.json({ success: true, emailSent: sent, seniorEmailSent: seniorSent, photo: file.filename });
});

app.get("/api/appointments", (req, res) => {
  try { res.json(readJson("appointments.json")); } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/appointments", (req, res) => {
  try {
    const apps = readJson("appointments.json");
    const appt = { id: Date.now().toString(), ...req.body };
    apps.push(appt);
    writeJson("appointments.json", apps);
    res.json({ success: true, appointment: appt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/appointments/:id", (req, res) => {
  try {
    writeJson("appointments.json", readJson("appointments.json").filter(a => a.id !== req.params.id));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/bookings", (req, res) => { try { res.json(loadBookings()); } catch (err) { res.status(500).json({ error: err.message }); } });
app.post("/api/bookings", (req, res) => {
  try {
    const bookings = loadBookings();
    const key = Date.now().toString();
    bookings[key] = { ...req.body, bookedAt: new Date().toISOString() };
    saveBookings(bookings);
    res.json({ success: true, key });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete("/api/bookings/:key", (req, res) => {
  try {
    const bookings = loadBookings();
    delete bookings[req.params.key];
    saveBookings(bookings);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post("/api/bookings/sync", (req, res) => {
  try {
    const local = req.body;
    const server = loadBookings();
    const merged = { ...server };
    let count = 0;
    Object.keys(local).forEach(key => { if (!merged[key]) { merged[key] = local[key]; count++; } });
    saveBookings(merged);
    res.json({ success: true, synced: count, total: Object.keys(merged).length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/waitlist", (req, res) => {
  const p = path.join(DATA_DIR, "waitlist.json");
  if (!fs.existsSync(p)) return res.json([]);
  try { res.json(JSON.parse(fs.readFileSync(p, "utf8"))); } catch { res.json([]); }
});
app.post("/api/waitlist", (req, res) => {
  try {
    const p = path.join(DATA_DIR, "waitlist.json");
    let list = [];
    if (fs.existsSync(p)) try { list = JSON.parse(fs.readFileSync(p, "utf8")); } catch {}
    list.push({ ...req.body, joinedAt: new Date().toISOString() });
    fs.writeFileSync(p, JSON.stringify(list, null, 2));
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/stripe/config", (req, res) => {
  res.json({ configured: stripe.isConfigured(), publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "" });
});

app.post("/api/stripe/create-checkout", async (req, res) => {
  try {
    const { plan, customerId, successUrl, cancelUrl } = req.body;
    const session = await stripe.createCheckoutSession(plan, customerId, successUrl || "https://popsyard.com/book?success=1", cancelUrl || "https://popsyard.com/book?canceled=1");
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/stripe/webhook", async (req, res) => {
  try {
    const event = await stripe.handleWebhook(req.body, req.headers["stripe-signature"]);
    if (event.type === "checkout.session.completed") {
      if (event.subscriptionId) {
        db.db.prepare("UPDATE subscriptions SET stripe_subscription_id = ? WHERE customer_id = ? AND stripe_subscription_id IS NULL").run(event.subscriptionId, event.customerId);
      }
      if (event.mode === "payment" && event.plan === "one_time") {
        const otc = db.db.prepare("SELECT * FROM one_time_cleans WHERE customer_id = ? AND stripe_payment_intent_id IS NULL ORDER BY created_at DESC LIMIT 1").get(event.customerId);
        if (otc) db.db.prepare("UPDATE one_time_cleans SET stripe_payment_intent_id = ? WHERE id = ?").run(event.paymentIntentId, otc.id);
      }
      // Send payment confirmation to customer
      const customer = db.getCustomerWithSubscription(event.customerId);
      if (customer && customer.email) {
        const planLabel = event.plan === "one_time" ? "One-Time Clean" : event.plan === "silver" ? "Silver Membership" : "Gold Membership";
        const confirmHtml = `<h2>Payment Confirmed!</h2><p>Hi ${customer.name},</p><p>Your payment for <strong>${planLabel}</strong> was successful. We'll be in touch to schedule your first visit.</p><p style="color:#888">- Zeph, popsyard.com</p>`;
        sendEmail(customer.email, "Payment Confirmed — popsyard.com", confirmHtml);
      }
    }
    if (event.type === "customer.subscription.deleted") {
      db.db.prepare("UPDATE subscriptions SET status = 'canceled', end_date = ? WHERE stripe_subscription_id = ?").run(new Date().toISOString().slice(0, 10), event.subscriptionId);
    }
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, phone, email, seniorName, seniorPhone, address, dogs, notes } = req.body;
    const id = db.uid();
    const seniorId = db.uid();
    db.createCustomer.run(id, name, phone || null, email || null, null);
    db.createSenior.run(seniorId, id, seniorName || name, seniorPhone || phone || null, address || null, notes || null, dogs || null);
    res.json({ success: true, customerId: id, seniorId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/subscriptions", async (req, res) => {
  try {
    const { customerId, plan, dayOfWeek, timeSlot, seniorId: skipSenior } = req.body;
    const existing = db.activeSubscription.get(customerId);
    if (existing) return res.status(400).json({ error: "Customer already has an active subscription" });
    const subId = db.uid();
    const startDate = db.today();
    const seniorId = skipSenior || db.seniorsByCustomer.get(customerId)?.id;
    if (!seniorId) return res.status(400).json({ error: "No senior record for this customer" });
    const visitCount = 4;
    const founderCount = db.db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active' AND founding_member = 1").get().c;
    const foundingMember = founderCount < 10 ? 1 : 0;
    db.createSubscription.run(subId, customerId, seniorId, plan, null, startDate, dayOfWeek, timeSlot, visitCount, foundingMember);
    const dates = db.generateAppointmentDates(dayOfWeek, startDate, visitCount);
    dates.forEach(date => {
      db.createAppointment.run(db.uid(), subId, customerId, seniorId, date, timeSlot, "scheduled", null, "subscription");
    });

    if (calendar.isConfigured()) {
      const customer = db.customerById.get(customerId);
      const senior = db.seniorsByCustomer.get(customerId);
      const summary = `${plan === "silver" ? "Silver" : "Gold"} Visit - ${senior?.name || customer?.name}`;
      for (const date of dates) {
        await calendar.createEvent(summary, date, timeSlot, senior?.address, null, 60);
      }
    }

    res.json({ success: true, subscriptionId: subId, appointments: dates.length, foundingMember });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/customers", (req, res) => {
  try { res.json(db.allCustomers()); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/customers/:id", (req, res) => {
  try {
    const data = db.getCustomerWithSubscription(req.params.id);
    if (!data) return res.status(404).json({ error: "Not found" });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/check-conflicts", (req, res) => {
  try {
    const { dayOfWeek, timeSlot, startDate, count } = req.query;
    if (!dayOfWeek || !timeSlot) return res.status(400).json({ error: "dayOfWeek and timeSlot required" });
    const visitCount = parseInt(count) || 4;
    const dates = db.generateAppointmentDates(dayOfWeek, startDate || db.today(), visitCount);
    const result = db.checkConflicts(dates, timeSlot);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/calendar/month", (req, res) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();
    res.json(db.getAppointmentsForCalendar(month, year));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/calendar/appointments", (req, res) => {
  try {
    const { customerId, seniorId, date, timeSlot, notes, type, subscriptionId } = req.body;
    if (!customerId || !date || !timeSlot) return res.status(400).json({ error: "customerId, date, timeSlot required" });
    const id = db.uid();
    db.createAppointment.run(id, subscriptionId || null, customerId, seniorId || null, date, timeSlot, "scheduled", notes || null, type || "manual");
    const c = db.customerById.get(customerId);
    const s = seniorId ? db.db.prepare("SELECT * FROM seniors WHERE id = ?").get(seniorId) : null;
    if (calendar.isConfigured()) {
      const summary = `Visit - ${s?.name || c?.name}`;
      console.log("Creating Calendar event:", summary, date, timeSlot);
      calendar.createEvent(summary, date, timeSlot, s?.address, notes, 60).then(r => {
        if (r.success) console.log("Calendar event created:", r.htmlLink);
        else console.log("Calendar event error:", r.error);
      });
    }
    res.json({ success: true, id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/api/calendar/appointments/:id", (req, res) => {
  try {
    const { date, timeSlot, status, notes } = req.body;
    db.updateAppointment.run(date, timeSlot, status || "scheduled", notes || null, req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/calendar/appointments/:id", (req, res) => {
  try {
    db.deleteAppointment.run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/sms/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: "to and message required" });
    const result = await twilio.sendSms(to, message);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/sms/booking-confirmation", async (req, res) => {
  try {
    const { customerName, customerPhone, seniorName, seniorPhone, plan, day, time } = req.body;
    const results = await twilio.sendBookingConfirmation(customerName, customerPhone, seniorName, seniorPhone, plan, day, time);
    res.json({ results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api/renewals/due", (req, res) => {
  try {
    const nearEnd = db.db.prepare(`SELECT s.*, c.name as customer_name, c.phone as customer_phone,
      sn.name as senior_name, sn.phone as senior_phone,
      (SELECT response FROM renewal_sms_log WHERE subscription_id = s.id ORDER BY sent_at DESC LIMIT 1) as last_renewal_response
      FROM subscriptions s
      JOIN customers c ON c.id = s.customer_id
      JOIN seniors sn ON sn.id = s.senior_id
      WHERE s.status = 'active'
      AND s.start_date <= date('now', '-21 days')
      AND ((SELECT MAX(sent_at) FROM renewal_sms_log WHERE subscription_id = s.id) IS NULL
        OR (SELECT MAX(sent_at) FROM renewal_sms_log WHERE subscription_id = s.id) < date('now', '-3 days'))
    `).all();
    res.json(nearEnd);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/renewals/respond", async (req, res) => {
  try {
    const { subscriptionId, response } = req.body;
    if (!subscriptionId || !response) return res.status(400).json({ error: "subscriptionId and response required" });
    db.logRenewalSms.run(subscriptionId, response);
    const sub = db.db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId);
    if (!sub) return res.status(404).json({ error: "Subscription not found" });
    if (response === "yes") {
      const newStart = db.addDays(sub.end_date || sub.start_date, 1);
      db.renewSubscription.run(newStart, subscriptionId);
      const dates = db.generateAppointmentDates(sub.day_of_week, newStart, sub.visit_count);
      dates.forEach(date => {
        db.createAppointment.run(db.uid(), subscriptionId, sub.customer_id, sub.senior_id, date, sub.time_slot, "scheduled", null, "subscription");
      });
      res.json({ success: true, renewed: true, appointments: dates.length });
    } else {
      db.cancelSubscription.run(db.today(), subscriptionId);
      res.json({ success: true, renewed: false, canceled: true });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/calendar/share", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  const result = await calendar.shareCalendarWithUser(email);
  res.json(result);
});

app.get("/api/calendar/info", async (req, res) => {
  const result = await calendar.getCalendarLink();
  res.json(result);
});

app.post("/api/calendar/primary-to-secondary", async (req, res) => {
  // Create secondary calendar and set it as the new CALENDAR_ID
  const result = await calendar.createSecondaryCalendar("Pops Yard Care Schedule");
  if (!result.success) return res.json(result);
  // Return instructions to switch
  res.json({ ...result, nextStep: "Set GOOGLE_CALENDAR_ID=" + result.id + " in Railway env vars, then redeploy." });
});

app.get("/api/calendar/events", async (req, res) => {
  const result = await calendar.listUpcomingEvents();
  res.json(result);
});

app.get("/api/status", (req, res) => {
  res.json({
    stripe: stripe.isConfigured(),
    calendar: calendar.isConfigured(),
    twilio: twilio.isConfigured(),
    email: !!loadConfig(),
    hasGoogleKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  });
});

app.listen(PORT, () => {
  console.log(`popsyard.com server running on port ${PORT}`);
  console.log(`Stripe: ${stripe.isConfigured() ? "configured" : "not configured (set STRIPE_SECRET_KEY)"}`);
  console.log(`Calendar: ${calendar.isConfigured() ? "configured" : "not configured (set GOOGLE_SERVICE_ACCOUNT_JSON)"}`);
  console.log(`Twilio: ${twilio.isConfigured() ? "configured" : "not configured (set TWILIO_* env vars)"}`);
  console.log(`Email: ${loadConfig() ? "configured" : "not configured (edit email-config.json or set env vars)"}`);
});
