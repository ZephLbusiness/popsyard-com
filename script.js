const BACKEND_URL = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? "http://localhost:3456" : "https://shimmering-inspiration-production-d0a3.up.railway.app";
const SPOTS_TOTAL = 5;
let spotsRemaining = SPOTS_TOTAL;

const concepts = {
  neighbor: {
    className: "",
    brandMark: "D",
    brandName: "Doody Duty",
  },
  subscription: {
    className: "theme-subscription",
    brandMark: "P",
    brandName: "Pickup Day",
  },
  premium: {
    className: "theme-premium",
    brandMark: "P",
    brandName: "popsyard.com",
    eyebrow: "Senior-friendly yard, plant & kennel service",
    headline: "A clean, safe yard for grandparents to enjoy with the grandkids.",
    lead: "We scoop the poop, water the plants, and clean the kennels so seniors don\u2019t have to bend, lift, or strain. One reliable weekly visit, one simple routine \u2014 plus a photo sent straight to you.",
    primaryCta: "Apply for membership",
    secondaryCta: "See what\u2019s included",
    ownerName: "Your senior yard crew",
    ownerNote: "Poop, plants & kennels every visit.",
    promiseTitle: "Everything included. Nothing for them to do.",
    promiseText: "Poop pickup, flower and garden watering, and dog kennel cleaning \u2014 all in one weekly visit. We send a photo after every visit so you know it\u2019s done. No bending, no lifting, no worrying.",
    processTitle: "Apply once. We handle the rest.",
    pricingTitle: "Senior Yard Care \u2014 from $59.99",
    pricingText: "Affordable one-time cleans, deep cleans, and weekly memberships. Seniors & retirees only. Limited to 5 clients per week.",
    ctaTitle: "Apply for senior yard membership",
    formButton: "Submit application",
    heroImage: "https://images.unsplash.com/photo-1517423440428-a5a00ad493e8?auto=format&fit=crop&w=1100&q=85",
    trust: ["One-time & membership plans", "Photo sent to family", "No bending, no lifting"],
    proof: [
      ["Deep clean", "or weekly care"],
      ["Photo proof", "sent to your family"],
      ["Same crew", "every single visit"],
      ["Risk-free", "first visit on us"],
    ],
    promises: [
      ["Photo sent to adult children", "We email a photo after every visit so the family knows the yard is clean and safe."],
      ["Gate check & lock confirm", "We confirm the gate is locked behind us every time. Seniors never have to worry."],
      ["Same crew, every visit", "The same friendly face every week. No strangers, no surprises."],
    ],
    steps: [
      ["Apply for membership", "Tell us about your parents\u2019 yard and what they need. We\u2019ll check availability."],
      ["We confirm your spot", "One of our 5 weekly client spots. Flexible one-time or membership plans."],
      ["We send photo updates", "A photo after every visit sent directly to the adult child\u2019s email."],
    ],
    pricing: [
      ["One-Time Clean", "$59.99", "Poop scoop, plant watering, and kennel cleaning. No lawn mowing — just the essential cleanup.", [
        "Poop scoop & haul",
        "Plant & garden watering",
        "Kennel cleaning & hose-down",
        "The first clean is always free (at any new location)*",
      ]],
      ["Silver Deep Clean", "$159.99", "One-time deep clean with lawn mowing, weed pulling, brush clearing, poop, plants, and kennels. All the regular stuff plus extra care.", [
        "Lawn mowing & trimming",
        "Weed pulling & brush clearing",
        "Poop scooping every single visit",
        "Plant & garden watering",
        "Kennel cleaning & hose-down",
        "Photo sent to your email after every visit",
        "Gate check & lock confirmation",
        "The first clean is always free (at any new location)*",
      ]],
      ["Gold Membership", "$359.99/mo", "4 weeks of weekly service — same deep care as Silver (lawn mowing, weed pulling, brush clearing, poop, plants, kennels) plus mulch laying for small to medium gardens.", [
        "Weekly lawn mowing & trimming",
        "Weed pulling & brush clearing every visit",
        "Mulch laying for small to medium gardens",
        "Poop scooping every single visit",
        "Plant & garden watering",
        "Kennel cleaning & hose-down",
        "Photo sent to your email after every visit",
        "Gate check & lock confirmation",
        "4 weekly visits — pays for 3 weeks, gets 1 extra free",
      ]],
    ],
    carouselLabel: "Local dogs on our cleanup route",
    dogCarousel: [
      { name: "Meet Maple", note: "Tuesday route, backyard explorer.", image: "https://images.unsplash.com/photo-1561037404-61cd46aa615b?auto=format&fit=crop&w=1100&q=85", color: "#ffd166" },
      { name: "Meet Biscuit", note: "Friday route, champion dig supervisor.", image: "https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=1100&q=85", color: "#8fd87a" },
      { name: "Meet Cooper", note: "Wednesday route, tail-wagging yard inspector.", image: "https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=1100&q=85", color: "#c084fc" },
      { name: "Meet Juniper", note: "Monday route, patio sunbeam regular.", image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1100&q=85", color: "#f4978e" },
      { name: "Meet Taco", note: "Thursday route, tiny yard boss.", image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=1100&q=85", color: "#9dffb0" },
    ],
  },
};

const tabs = document.querySelectorAll(".concept-tab");
const body = document.body;
let carouselTimer;
let carouselIndex = 0;
const bookedSlotsKey = "pickupDayBookedSlots";

function cardHtml(items, type) {
  if (type === "pricing") {
    return items.map((item, index) => {
      const details = item[3] || [];
      const detailsHtml = details.length ? `<div class="pricing-details" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)"><ul style="margin:0;padding:0;list-style:none;font-size:0.85rem;line-height:1.8">${details.map(d => `<li style="padding:2px 0">\u2713 ${d}</li>`).join("")}</ul></div>` : "";
      return `<article class="${index === 1 ? "featured" : ""}" style="position:relative">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <h3 style="margin:0">${item[0]}</h3>
          ${details.length ? `<button class="pricing-toggle" onclick="togglePricingDetails(this)" style="background:none;border:1px solid var(--line);border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:0.8rem;display:grid;place-items:center;flex-shrink:0;color:var(--muted)">\u25BC</button>` : ""}
        </div>
        <strong>${item[1]}</strong>
        <p>${item[2]}</p>
        ${detailsHtml}
      </article>`;
    }).join("");
  }
  if (type === "testimonials") {
    return items.map((item) => `<blockquote>"${item[0]}"<cite>${item[1]}</cite></blockquote>`).join("");
  }
  if (type === "proof") {
    return items.map((item) => `<div><strong>${item[0]}</strong><span>${item[1]}</span></div>`).join("");
  }
  if (type === "steps") {
    return items.map((item, index) => `<article><span>${index + 1}</span><h3>${item[0]}</h3><p>${item[1]}</p></article>`).join("");
  }
  return items.map((item, index) => `<article><span class="icon">${index + 1}</span><h3>${item[0]}</h3><p>${item[1]}</p></article>`).join("");
}

function setConcept(key) {
  const concept = concepts[key];
  body.className = concept.className;
  clearInterval(carouselTimer);
  carouselIndex = 0;

  document.querySelectorAll("[data-copy]").forEach((node) => {
    const field = node.dataset.copy;
    if (field === "heroImage") { node.src = concept.heroImage; return; }
    if (field === "brandMark") return;
    if (concept[field] !== undefined) node.textContent = concept[field];
  });

  document.querySelector('[data-list="trust"]').innerHTML = concept.trust.map((item) => `<span>${item}</span>`).join("");
  document.querySelector('[data-section="proof"]').innerHTML = cardHtml(concept.proof, "proof");
  document.querySelector('[data-section="promises"]').innerHTML = cardHtml(concept.promises, "promises");
  document.querySelector('[data-section="steps"]').innerHTML = cardHtml(concept.steps, "steps");
  document.querySelector('[data-section="pricing"]').innerHTML = cardHtml(concept.pricing, "pricing");
  updateCarousel(concept);

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.theme === key);
  });
}

function updateCarousel(concept) {
  const heroPhoto = document.querySelector(".hero-photo");
  const heroImage = document.querySelector('[data-copy="heroImage"]');
  const ownerName = document.querySelector('[data-copy="ownerName"]');
  const ownerNote = document.querySelector('[data-copy="ownerNote"]');
  let carouselBadge = document.querySelector(".carousel-badge");
  let carouselDots = document.querySelector(".carousel-dots");

  if (!carouselBadge) {
    carouselBadge = document.createElement("div");
    carouselBadge.className = "carousel-badge";
    heroPhoto.appendChild(carouselBadge);
  }
  if (!carouselDots) {
    carouselDots = document.createElement("div");
    carouselDots.className = "carousel-dots";
    heroPhoto.appendChild(carouselDots);
  }

  if (!concept.dogCarousel) {
    heroPhoto.classList.remove("is-carousel");
    heroPhoto.style.removeProperty("--dog-color");
    carouselBadge.hidden = true;
    carouselDots.hidden = true;
    return;
  }

  heroPhoto.classList.add("is-carousel");
  carouselBadge.hidden = false;
  carouselDots.hidden = false;
  carouselBadge.textContent = concept.carouselLabel;
  carouselDots.innerHTML = concept.dogCarousel.map((_, index) => `<span class="${index === 0 ? "active" : ""}"></span>`).join("");

  const showDog = (index) => {
    const dog = concept.dogCarousel[index];
    heroImage.src = dog.image;
    ownerName.textContent = dog.name;
    ownerNote.textContent = dog.note;
    heroPhoto.style.setProperty("--dog-color", dog.color);
    carouselDots.querySelectorAll("span").forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === index);
    });
  };

  showDog(0);
  carouselTimer = setInterval(() => {
    carouselIndex = (carouselIndex + 1) % concept.dogCarousel.length;
    showDog(carouselIndex);
  }, 2600);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setConcept(tab.dataset.theme));
});

setConcept("premium");
setupOrderForm();
loadCrewProfile();

function togglePricingDetails(btn) {
  const allDetails = document.querySelectorAll(".pricing-details");
  const allToggles = document.querySelectorAll(".pricing-toggle");
  const isOpen = allDetails.length > 0 && allDetails[0].style.display !== "none";
  allDetails.forEach(d => { d.style.display = isOpen ? "none" : "block"; });
  allToggles.forEach(t => { t.textContent = isOpen ? "\u25BC" : "\u25B2"; });
}
window.addEventListener("storage", function(e) {
  if (e.key === "crewProfile") loadCrewProfile();
});

function loadCrewProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem("crewProfile")) || {};
    if (profile.name) document.getElementById("crew-name").textContent = profile.name;
    if (profile.title) document.getElementById("crew-title").textContent = profile.title;
    if (profile.bio) document.getElementById("crew-bio").textContent = profile.bio;
    if (profile.photo) {
      const img = document.getElementById("crew-photo");
      const placeholder = document.getElementById("crew-photo-placeholder");
      img.src = profile.photo;
      img.style.display = "block";
      if (placeholder) placeholder.style.display = "none";
    }
  } catch {}
}

function getBookedSlots() {
  try { return JSON.parse(localStorage.getItem(bookedSlotsKey)) || {}; } catch { return {}; }
}
function saveBookedSlots(slots) {
  localStorage.setItem(bookedSlotsKey, JSON.stringify(slots));
}

async function syncBookingToBackend(key, booking) {
  try {
    await fetch(BACKEND_URL + "/api/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(booking)
    });
  } catch {}
}

const DALLAS_OR = { lat: 44.9193, lon: -123.3170 };
const MAX_MILES = 11;
let addressValid = false;
let addressCheckTimer;

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showAddressError(msg) {
  const el = document.getElementById("address-error");
  el.textContent = msg;
  el.style.display = "block";
  addressValid = false;
}
function clearAddressError() {
  const el = document.getElementById("address-error");
  el.textContent = "";
  el.style.display = "none";
  addressValid = true;
}

async function validateAddress(address) {
  if (!address || address.trim().length < 5) { clearAddressError(); return; }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, {
      headers: { "User-Agent": "YardCareClub/1.0" }
    });
    const data = await res.json();
    if (!data || !data.length) {
      showAddressError("Couldn't find that address. Please check and try again.");
      return;
    }
    const dist = haversineDistance(DALLAS_OR.lat, DALLAS_OR.lon, parseFloat(data[0].lat), parseFloat(data[0].lon));
    if (dist > MAX_MILES) {
      showAddressError("This address is " + Math.round(dist) + " miles from Dallas, OR \u2014 outside our 11-mile service area.");
    } else {
      clearAddressError();
    }
  } catch {
    showAddressError("Couldn't verify address. Try again or contact us.");
  }
}

async function notifyBackend(booking) {
  if (!BACKEND_URL) return;
  try {
    await fetch(BACKEND_URL + "/api/notify-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking),
    });
  } catch {
    console.log("Backend not running — email notification skipped.");
  }
}

function toggleYardSize(sel) {
  const area = document.getElementById("index-yard-size");
  const warning = document.getElementById("index-yard-size-warning");
  const submitBtn = document.querySelector("#service-order-form button[type=submit]");
  if (submitBtn) submitBtn.disabled = false;
  if (area) {
    area.style.display = sel.value === "Silver Deep Clean" ? "block" : "none";
    warning.style.display = "none";
    document.querySelectorAll('[name="yardSize"]').forEach(r => r.checked = false);
  }
}

function checkYardSize(el) {
  const warning = document.getElementById("index-yard-size-warning");
  const submitBtn = document.querySelector("#service-order-form button[type=submit]");
  if (el.value === "large") {
    warning.style.display = "block";
    if (submitBtn) submitBtn.disabled = true;
  } else {
    warning.style.display = "none";
    if (submitBtn) submitBtn.disabled = false;
  }
}

function setupOrderForm() {
  const form = document.querySelector("#service-order-form");
  const message = document.querySelector("#booking-message");
  if (!form || !message) return;

  try {
    const saved = JSON.parse(localStorage.getItem("savedCustomerInfo"));
    if (saved) {
      if (saved.name) form.elements.name.value = saved.name;
      if (saved.phone) form.elements.phone.value = saved.phone;
      if (saved.email) form.elements.email.value = saved.email;
      if (saved.address) form.elements.address.value = saved.address;
      if (saved.recipientName && form.elements.recipientName) form.elements.recipientName.value = saved.recipientName;
      if (saved.recipientPhone && form.elements.recipientPhone) form.elements.recipientPhone.value = saved.recipientPhone;
    }
  } catch {}

  form.elements.address.addEventListener("input", () => {
    clearTimeout(addressCheckTimer);
    addressCheckTimer = setTimeout(() => validateAddress(form.elements.address.value), 800);
  });

  const spotEl = document.getElementById("spots-remaining");
  updateSpotsDisplay();

  async function updateSpotsDisplay() {
    const capacityRes = await fetch(BACKEND_URL + "/api/waiting-list/capacity", { signal: AbortSignal.timeout(5000) }).catch(() => null);
    let spotsLeft = 5;
    if (capacityRes) {
      const data = await capacityRes.json();
      spotsLeft = data.spotsLeft;
    }
    if (spotEl) spotEl.textContent = Math.max(0, spotsLeft);

    const bannerText = document.getElementById("spots-banner-text");
    if (bannerText) {
      if (spotsLeft <= 0) {
        bannerText.innerHTML = '&#x26A0; All client spots are filled. <a href="#quote" style="color:var(--accent)">Join the waiting list</a> for the next opening.';
      } else {
        bannerText.innerHTML = `&#x26A0; now accepting clients &mdash; limited to <strong>5 clients per week</strong>.
      <span id="spots-remaining" style="color:var(--accent)">${spotsLeft}</span> spot${spotsLeft > 1 ? "s" : ""} left.`;
      }
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const bookedSlots = getBookedSlots();

    const capacityRes = await fetch(BACKEND_URL + "/api/waiting-list/capacity", { signal: AbortSignal.timeout(5000) }).catch(() => null);
    let spotsLeft = 5;
    if (capacityRes) {
      const capacityData = await capacityRes.json();
      spotsLeft = capacityData.spotsLeft;
    }

    if (spotsLeft <= 0) {
      const body = {
        name: formData.get("name"),
        phone: formData.get("phone"),
        email: formData.get("email"),
        seniorName: formData.get("recipientName") || "",
        seniorPhone: formData.get("recipientPhone") || "",
        address: formData.get("address"),
        dogs: formData.get("dogs"),
        plan: formData.get("plan"),
        notes: formData.get("notes"),
      };
      const joinRes = await fetch(BACKEND_URL + "/api/waiting-list/join", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      }).catch(() => null);
      message.className = "booking-message field-wide is-success";
      if (joinRes) {
        message.textContent = "All client spots are currently filled. You've been added to the waiting list! We'll email you as soon as a spot opens up.";
      } else {
        message.textContent = "You've been added to the waiting list. We'll contact you when a spot opens up.";
      }
      form.reset();
      clearAddressError();
      return;
    }

    if (!addressValid) {
      const err = document.getElementById("address-error");
      if (!err.textContent) err.textContent = "Please enter a valid address within 11 miles of Dallas, OR.";
      err.style.display = "block";
      return;
    }

    const key = Date.now();

    const recipientPhone = formData.get("recipientPhone") || "";
    const booking = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      recipientName: formData.get("recipientName") || "",
      recipientPhone: recipientPhone,
      address: formData.get("address"),
      dogs: formData.get("dogs"),
      plan: formData.get("plan"),
      preferredEmployee: formData.get("preferredEmployee") || "",
      notes: formData.get("notes"),
      bookedAt: new Date().toISOString(),
    };

    bookedSlots[key] = booking;
    saveBookedSlots(bookedSlots);
    syncBookingToBackend(key, booking);

    await notifyBackend(booking);

    try {
      const crew = JSON.parse(localStorage.getItem("crewProfile")) || {};
      const crewPhone = crew.phone ? crew.phone.replace(/[^0-9]/g, "") : "";
      const customerPhone = booking.phone.replace(/[^0-9]/g, "");
      const seniorPhone = recipientPhone.replace(/[^0-9]/g, "");
      const allPhones = [crewPhone, customerPhone, seniorPhone].filter(Boolean).join(";");
      if (allPhones) {
        const intro = `Hi ${booking.name.split(" ")[0]}! Welcome to popsyard.com! I'm Zeph, and I'll be taking care of the yard. I just received your application and I'll be in touch soon to confirm everything. So excited to have you and your family! \u{1F49A}`;
        window.open(`sms:${allPhones}?body=${encodeURIComponent(intro)}`, "_blank");
      }
    } catch {}

    message.className = "booking-message field-wide is-success";
    message.textContent = "Thank you for your application! We'll review it and contact you within 24 hours to confirm your senior yard membership.";
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 1500);
    const savedInfo = { name: booking.name, phone: booking.phone, email: booking.email, address: booking.address, recipientName: booking.recipientName, recipientPhone: booking.recipientPhone };
    localStorage.setItem("savedCustomerInfo", JSON.stringify(savedInfo));

    form.reset();
    clearAddressError();

    updateSpotsDisplay();
  });
}
