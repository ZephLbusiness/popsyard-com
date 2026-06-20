const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

let raw = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim().replace(/^['"]|['"]$/g, "");

const KEY_FILES = [
  path.join(__dirname, "data", "google-service-account.json"),
  path.join(__dirname, "google-key.json"),
];
if (raw.length < 50) {
  for (const kf of KEY_FILES) {
    try { if (fs.existsSync(kf)) { raw = fs.readFileSync(kf, "utf8"); break; } } catch {}
  }
}

let calendarClient = null;

function tryParse(str) {
  if (!str || str.length < 50) return null;
  if (str.includes("private_key")) try { return JSON.parse(str); } catch {}
  try { const d = JSON.parse(Buffer.from(str, "base64").toString()); if (d && d.private_key) return d; } catch {}
  return null;
}

if (raw) console.log("Calendar: raw length =", raw.length);
try {
  const credentials = tryParse(raw);
  if (credentials) {
    const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/calendar"] });
    calendarClient = google.calendar({ version: "v3", auth });
  }
} catch {}

function isConfigured() { return !!calendarClient; }

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

async function createEvent(summary, date, timeSlot, address, notes, durationMinutes) {
  if (!calendarClient) return { error: "Google Calendar not configured. Set GOOGLE_SERVICE_ACCOUNT_JSON env var." };
  const timeMap = { "11am": "11:00", "3pm": "15:00", "4pm": "16:00", "5pm": "17:00" };
  const startTime = timeMap[timeSlot] || "11:00";
  const startDateTime = `${date}T${startTime}:00`;
  const endDate = new Date(`${date}T${startTime}:00`);
  endDate.setMinutes(endDate.getMinutes() + (durationMinutes || 60));
  const endDateTime = endDate.toISOString().split(".")[0];
  try {
    const event = await calendarClient.events.insert({
      calendarId: CALENDAR_ID,
      resource: {
        summary,
        description: `Address: ${address || "N/A"}\nNotes: ${notes || "None"}`,
        start: { dateTime: startDateTime, timeZone: "America/Los_Angeles" },
        end: { dateTime: endDateTime, timeZone: "America/Los_Angeles" },
      },
    });
    return { success: true, eventId: event.data.id, htmlLink: event.data.htmlLink };
  } catch (err) {
    console.error("Google Calendar createEvent error:", err.message);
    return { error: err.message };
  }
}

async function updateEvent(eventId, summary, date, timeSlot, address, notes) {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  const timeMap = { "11am": "11:00", "3pm": "15:00", "4pm": "16:00", "5pm": "17:00" };
  const startTime = timeMap[timeSlot] || "11:00";
  const startDateTime = `${date}T${startTime}:00`;
  const endDate = new Date(`${date}T${startTime}:00`);
  endDate.setMinutes(endDate.getMinutes() + 60);
  const endDateTime = endDate.toISOString().split(".")[0];
  try {
    await calendarClient.events.update({
      calendarId: CALENDAR_ID,
      eventId,
      resource: {
        summary,
        description: `Address: ${address || "N/A"}\nNotes: ${notes || "None"}`,
        start: { dateTime: startDateTime, timeZone: "America/Los_Angeles" },
        end: { dateTime: endDateTime, timeZone: "America/Los_Angeles" },
      },
    });
    return { success: true };
  } catch (err) {
    console.error("Google Calendar updateEvent error:", err.message);
    return { error: err.message };
  }
}

async function deleteEvent(eventId) {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    await calendarClient.events.delete({ calendarId: CALENDAR_ID, eventId });
    return { success: true };
  } catch (err) {
    console.error("Google Calendar deleteEvent error:", err.message);
    return { error: err.message };
  }
}

async function shareCalendarWithUser(userEmail) {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    const acl = await calendarClient.acl.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        role: "reader",
        scope: { type: "user", value: userEmail },
      },
    });
    return { success: true, aclId: acl.data.id };
  } catch (err) {
    console.error("Google Calendar shareCalendar error:", err.message);
    return { error: err.message };
  }
}

async function makeCalendarPublic() {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    const acl = await calendarClient.acl.list({ calendarId: CALENDAR_ID });
    console.log("Existing ACL rules:", JSON.stringify(acl.data.items.map(i => ({ role: i.role, scope: i.scope }))));
  } catch (err) {
    console.error("Google Calendar list ACL error:", err.message);
  }
  try {
    const acl = await calendarClient.acl.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        role: "reader",
        scope: { type: "default" },
      },
    });
    return { success: true, aclId: acl.data.id, note: "Calendar is now publicly readable" };
  } catch (err) {
    console.error("Google Calendar makePublic error:", err.message);
    return { error: err.message, details: err.errors };
  }
}

async function createSecondaryCalendar(name) {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    const cal = await calendarClient.calendars.insert({
      requestBody: {
        summary: name || "Pops Yard Care",
        description: "Yard care service appointments",
      },
    });
    console.log("Created secondary calendar:", cal.data.id);
    return { success: true, id: cal.data.id, summary: cal.data.summary };
  } catch (err) {
    console.error("Google Calendar createSecondary error:", err.message);
    return { error: err.message };
  }
}

async function getCalendarLink() {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    const calendar = await calendarClient.calendars.get({ calendarId: CALENDAR_ID });
    return { success: true, summary: calendar.data.summary, id: calendar.data.id };
  } catch (err) {
    return { error: err.message };
  }
}

async function listUpcomingEvents(maxResults = 20) {
  if (!calendarClient) return { error: "Google Calendar not configured" };
  try {
    const events = await calendarClient.events.list({
      calendarId: CALENDAR_ID,
      maxResults,
      timeMin: new Date().toISOString(),
      orderBy: "startTime",
      singleEvents: true,
    });
    return { success: true, items: events.data.items.map(e => ({
      summary: e.summary,
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      id: e.id,
    })) };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = { isConfigured, createEvent, updateEvent, deleteEvent, shareCalendarWithUser, makeCalendarPublic, createSecondaryCalendar, getCalendarLink, listUpcomingEvents };
