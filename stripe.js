const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
let stripe = null;
try {
  if (STRIPE_SECRET_KEY) stripe = require("stripe")(STRIPE_SECRET_KEY);
} catch {}

function isConfigured() { return !!stripe; }

const PRICES = {
  silver: { amount: 15999, currency: "usd", name: "Silver Deep Clean" },
  gold: { amount: 35999, currency: "usd", interval: "week", interval_count: 4, name: "Gold Membership" },
  one_time: { amount: 5999, currency: "usd", name: "One-Time Clean" },
};

async function createCheckoutSession(plan, customerId, successUrl, cancelUrl) {
  if (!stripe) throw new Error("Stripe not configured. Set STRIPE_SECRET_KEY env var.");
  const price = PRICES[plan];
  if (!price) throw new Error("Invalid plan: " + plan);
  const isOneTime = plan === "one_time" || plan === "silver";
  const mode = isOneTime ? "payment" : "subscription";
  const lineItems = [{
    price_data: {
      currency: price.currency,
      product_data: { name: price.name },
      unit_amount: price.amount,
      ...(mode === "subscription" ? { recurring: { interval: price.interval, interval_count: price.interval_count } } : {}),
    },
    quantity: 1,
  }];
  const session = await stripe.checkout.sessions.create({
    mode,
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: customerId,
    metadata: { plan, customer_id: customerId },
  });
  return session;
}

async function handleWebhook(rawBody, signature) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook not configured");
  const event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    return {
      type: "checkout.session.completed",
      customerId: session.client_reference_id || session.metadata?.customer_id,
      stripeCustomerId: session.customer,
      subscriptionId: session.subscription,
      paymentIntentId: session.payment_intent,
      plan: session.metadata?.plan,
      mode: session.mode,
    };
  }
  if (event.type === "invoice.payment_succeeded") {
    const invoice = event.data.object;
    return {
      type: "invoice.payment_succeeded",
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
    };
  }
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    return {
      type: "customer.subscription.deleted",
      subscriptionId: sub.id,
      customerId: sub.customer,
    };
  }
  return { type: "unhandled" };
}

module.exports = { isConfigured, createCheckoutSession, handleWebhook, PRICES };
