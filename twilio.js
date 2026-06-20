const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";
let twilioClient = null;

try {
  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    twilioClient = require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
} catch {}

function isConfigured() { return !!twilioClient && !!TWILIO_PHONE_NUMBER; }

async function sendSms(to, body) {
  if (!isConfigured()) {
    console.log(`[Twilio not configured] Would send to ${to}: ${body}`);
    return { error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars." };
  }
  try {
    const msg = await twilioClient.messages.create({ body, from: TWILIO_PHONE_NUMBER, to });
    return { success: true, sid: msg.sid };
  } catch (err) {
    console.error("Twilio sendSms error:", err.message);
    return { error: err.message };
  }
}

const TEMPLATES = {
  bookingConfirmation: (customerName, seniorName, plan, day, time) =>
    `Hi ${customerName}! Welcome to popsyard.com! 🎉 Your ${plan} plan is confirmed — ${seniorName}'s yard visits will be ${day}s at ${time}. We'll send a reminder before each visit. Can't wait to get started! 🌿 - Zeph`,

  dayBeforeReminder: (seniorName, day, time) =>
    `Hi there! Just a friendly reminder that Zeph will be visiting ${seniorName}'s yard tomorrow (${day}) at ${time}. Make sure the dogs are put away and the gate is accessible. See you then! 💚 - popsyard.com`,

  headingYourWay: (customerName, time) =>
    `Hi ${customerName}! Just wanted to let you know I'm heading your way and should arrive around ${time}. If you could make sure the dogs are put away, that would be great! See you soon! 🚙 - Zeph`,

  doneAndPhoto: (customerName) =>
    `Hi ${customerName}! All finished with the yard for today — everything looks beautiful! I've sent a photo to your email so you can see. Hope you have a wonderful day! 🌿📸 - Zeph`,

  renewalAsk: (customerName, plan, day, time) =>
    `Hi ${customerName}! 🎉 Your ${plan} plan has been amazing — ${day}'s yard has never looked better! Would you like to continue for another 4 weeks at ${day}s ${time}? Just reply YES to keep your spot! Your crew will be thrilled to keep serving you. 🌿💚 - Zeph`,

  renewalConfirmed: (customerName, plan, day, time) =>
    `Great news ${customerName}! ✅ Your ${plan} plan is renewed for another 4 weeks — ${day}s at ${time} just like always. Thank you for continuing with popsyard.com! See you soon! 🌿💚 - Zeph`,

  renewalDeclined: (customerName) =>
    `We understand ${customerName}. Thank you for being part of popsyard.com! Your final visit is coming up. If you ever want to restart, just text us anytime. Wishing you and your family all the best! 💚 - Zeph`,
};

async function sendBookingConfirmation(customerName, customerPhone, seniorName, seniorPhone, plan, day, time) {
  const msg = TEMPLATES.bookingConfirmation(customerName, seniorName, plan, day, time);
  const results = [];
  if (customerPhone) results.push(await sendSms(customerPhone, msg));
  if (seniorPhone && seniorPhone !== customerPhone) results.push(await sendSms(seniorPhone, msg));
  return results;
}

async function sendDayBeforeReminder(seniorName, seniorPhone, day, time) {
  if (!seniorPhone) return [{ error: "No senior phone" }];
  return [await sendSms(seniorPhone, TEMPLATES.dayBeforeReminder(seniorName, day, time))];
}

async function sendDoneAndPhoto(customerName, customerPhone, seniorName, seniorPhone) {
  const msg = TEMPLATES.doneAndPhoto(customerName);
  const results = [];
  if (customerPhone) results.push(await sendSms(customerPhone, msg));
  if (seniorPhone && seniorPhone !== customerPhone) {
    const seniorMsg = `All finished with the yard for today! Everything looks great. Hope you enjoy your fresh, clean yard! 🌿 - popsyard.com`;
    results.push(await sendSms(seniorPhone, seniorMsg));
  }
  return results;
}

async function sendRenewalAsk(customerName, customerPhone, plan, day, time) {
  if (!customerPhone) return [{ error: "No customer phone" }];
  return [await sendSms(customerPhone, TEMPLATES.renewalAsk(customerName, plan, day, time))];
}

module.exports = {
  isConfigured, sendSms, TEMPLATES,
  sendBookingConfirmation, sendDayBeforeReminder,
  sendDoneAndPhoto, sendRenewalAsk,
};
