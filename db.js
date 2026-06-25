const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "silver-yard-care.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    stripe_customer_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS seniors (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    dogs TEXT
  );
  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    senior_id TEXT NOT NULL REFERENCES seniors(id),
    plan TEXT NOT NULL CHECK(plan IN ('silver','gold')),
    stripe_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','canceled','expired')),
    start_date TEXT NOT NULL,
    end_date TEXT,
    day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
    time_slot TEXT NOT NULL CHECK(time_slot IN ('11am','3pm','4pm','5pm')),
    visit_count INTEGER NOT NULL DEFAULT 4,
    founding_member INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    subscription_id TEXT REFERENCES subscriptions(id),
    customer_id TEXT NOT NULL,
    senior_id TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL CHECK(time_slot IN ('11am','3pm','4pm','5pm')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','done','canceled','conflict')),
    notes TEXT,
    type TEXT NOT NULL DEFAULT 'subscription' CHECK(type IN ('subscription','one_time','manual')),
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS one_time_cleans (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    senior_id TEXT NOT NULL REFERENCES seniors(id),
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL CHECK(time_slot IN ('11am','3pm','4pm','5pm')),
    stripe_payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','done','canceled')),
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS renewal_sms_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
    sent_at TEXT DEFAULT (datetime('now')),
    response TEXT CHECK(response IN ('yes','no','no_reply'))
  );
  CREATE TABLE IF NOT EXISTS waiting_list (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    senior_name TEXT,
    senior_phone TEXT,
    address TEXT NOT NULL,
    dogs TEXT,
    plan TEXT NOT NULL,
    notes TEXT,
    day_of_week TEXT,
    time_slot TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','notified','claimed','skipped','expired')),
    notified_at TEXT,
    claimed_at TEXT,
    claim_token TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function today() { return new Date().toISOString().slice(0, 10); }

function getNextDayOfWeek(dayName, fromDate) {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const target = days.indexOf(dayName);
  const d = new Date(fromDate);
  d.setDate(d.getDate() + ((target + 7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function generateAppointmentDates(dayOfWeek, startDate, count) {
  const dates = [];
  let current = startDate;
  for (let i = 0; i < count; i++) {
    current = getNextDayOfWeek(dayOfWeek, current);
    dates.push(current);
    current = addDays(current, 1);
  }
  return dates;
}

function activeClientCount() {
  return db.prepare("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'").get().c +
    db.prepare("SELECT COUNT(*) as c FROM one_time_cleans WHERE status = 'scheduled'").get().c;
}

function checkConflicts(dates, timeSlot, excludeId) {
  if (!dates.length) return { hasConflict: false, conflictingDates: [], alternatives: {} };
  const placeholders = dates.map(() => "?").join(",");
  let sql = `SELECT date, time_slot FROM appointments WHERE date IN (${placeholders}) AND time_slot = ? AND status = 'scheduled'`;
  const params = [...dates, timeSlot];
  if (excludeId) { sql += " AND id != ?"; params.push(excludeId); }
  const rows = db.prepare(sql).all(...params);
  if (!rows.length) return { hasConflict: false, conflictingDates: [], alternatives: {} };
  const conflictingDates = rows.map(r => r.date);
  const ALTS = ["11am", "3pm", "4pm", "5pm"].filter(t => t !== timeSlot);
  const alternatives = {};
  conflictingDates.forEach(date => {
    const busyOnDate = db.prepare("SELECT time_slot FROM appointments WHERE date = ? AND status = 'scheduled'").all(date).map(r => r.time_slot);
    const free = ALTS.filter(t => !busyOnDate.includes(t));
    if (free.length) alternatives[date] = free;
  });
  return { hasConflict: true, conflictingDates, alternatives };
}

function getCustomerWithSubscription(customerId) {
  const c = db.prepare("SELECT * FROM customers WHERE id = ?").get(customerId);
  if (!c) return null;
  const s = db.prepare("SELECT * FROM seniors WHERE customer_id = ?").get(customerId);
  const subs = db.prepare("SELECT * FROM subscriptions WHERE customer_id = ? AND status = 'active'").all(customerId);
  return { ...c, senior: s || null, subscriptions: subs };
}

function getAppointmentsForCalendar(month, year) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;
  return db.prepare(`SELECT a.*, c.name as customer_name, s.name as senior_name, s.address
    FROM appointments a
    LEFT JOIN customers c ON a.customer_id = c.id
    LEFT JOIN seniors s ON a.senior_id = s.id
    WHERE a.date BETWEEN ? AND ?
    ORDER BY a.date, a.time_slot`).all(start, end);
}

function allCustomers() {
  return db.prepare(`SELECT c.*, s.name as senior_name, s.phone as senior_phone, s.address, s.dogs, s.notes as senior_notes,
    sub.plan, sub.day_of_week, sub.time_slot, sub.status as sub_status, sub.id as sub_id
    FROM customers c
    LEFT JOIN seniors s ON s.customer_id = c.id
    LEFT JOIN subscriptions sub ON sub.customer_id = c.id AND sub.status = 'active'
    ORDER BY c.created_at DESC`).all();
}

module.exports = {
  db, uid, today, getNextDayOfWeek, addDays, generateAppointmentDates,
  checkConflicts, getCustomerWithSubscription, getAppointmentsForCalendar, allCustomers, activeClientCount,
  customers: db.prepare("SELECT * FROM customers ORDER BY created_at DESC"),
  customerById: db.prepare("SELECT * FROM customers WHERE id = ?"),
  createCustomer: db.prepare("INSERT INTO customers (id, name, phone, email, stripe_customer_id) VALUES (?, ?, ?, ?, ?)"),
  seniorsByCustomer: db.prepare("SELECT * FROM seniors WHERE customer_id = ?"),
  createSenior: db.prepare("INSERT INTO seniors (id, customer_id, name, phone, address, notes, dogs) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  createSubscription: db.prepare("INSERT INTO subscriptions (id, customer_id, senior_id, plan, stripe_subscription_id, start_date, day_of_week, time_slot, visit_count, founding_member) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  subscriptionsByCustomer: db.prepare("SELECT * FROM subscriptions WHERE customer_id = ? ORDER BY created_at DESC"),
  activeSubscription: db.prepare("SELECT * FROM subscriptions WHERE customer_id = ? AND status = 'active'"),
  cancelSubscription: db.prepare("UPDATE subscriptions SET status = 'canceled', end_date = ? WHERE id = ?"),
  renewSubscription: db.prepare("UPDATE subscriptions SET start_date = ?, end_date = NULL, status = 'active' WHERE id = ?"),
  createAppointment: db.prepare("INSERT INTO appointments (id, subscription_id, customer_id, senior_id, date, time_slot, status, notes, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"),
  deleteAppointment: db.prepare("DELETE FROM appointments WHERE id = ?"),
  updateAppointment: db.prepare("UPDATE appointments SET date = ?, time_slot = ?, status = ?, notes = ? WHERE id = ?"),
  appointmentById: db.prepare("SELECT * FROM appointments WHERE id = ?"),
  appointmentsBySubscription: db.prepare("SELECT * FROM appointments WHERE subscription_id = ? ORDER BY date"),
  upcomingAppointments: db.prepare("SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as senior_name, s.phone as senior_phone FROM appointments a LEFT JOIN customers c ON a.customer_id = c.id LEFT JOIN seniors s ON a.senior_id = s.id WHERE a.date >= ? AND a.status = 'scheduled' ORDER BY a.date, a.time_slot"),
  todaysAppointments: db.prepare("SELECT a.*, c.name as customer_name, c.phone as customer_phone, s.name as senior_name, s.phone as senior_phone FROM appointments a LEFT JOIN customers c ON a.customer_id = c.id LEFT JOIN seniors s ON a.senior_id = s.id WHERE a.date = ? AND a.status = 'scheduled' ORDER BY a.time_slot"),
  createOneTimeClean: db.prepare("INSERT INTO one_time_cleans (id, customer_id, senior_id, date, time_slot, stripe_payment_intent_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)"),
  logRenewalSms: db.prepare("INSERT INTO renewal_sms_log (subscription_id, response) VALUES (?, ?)"),
  renewalSmsLastSent: db.prepare("SELECT * FROM renewal_sms_log WHERE subscription_id = ? ORDER BY sent_at DESC LIMIT 1"),
  checkConflicts,
  createWaitingEntry: db.prepare("INSERT INTO waiting_list (id, name, phone, email, senior_name, senior_phone, address, dogs, plan, notes, day_of_week, time_slot, status, claim_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?)"),
  waitingListAll: db.prepare("SELECT * FROM waiting_list ORDER BY created_at ASC"),
  waitingListWaiting: db.prepare("SELECT * FROM waiting_list WHERE status = 'waiting' ORDER BY created_at ASC"),
  waitingFirst: db.prepare("SELECT * FROM waiting_list WHERE status = 'waiting' ORDER BY created_at ASC LIMIT 1"),
  waitingById: db.prepare("SELECT * FROM waiting_list WHERE id = ?"),
  waitingByToken: db.prepare("SELECT * FROM waiting_list WHERE claim_token = ?"),
  updateWaitingStatus: db.prepare("UPDATE waiting_list SET status = ?, notified_at = CASE WHEN ? = 'notified' THEN datetime('now') ELSE notified_at END, claimed_at = CASE WHEN ? = 'claimed' THEN datetime('now') ELSE claimed_at END WHERE id = ?"),
  deleteWaitingEntry: db.prepare("DELETE FROM waiting_list WHERE id = ?"),
};
