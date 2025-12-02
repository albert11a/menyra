import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  serverTimestamp,
  updateDoc,
  addDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* =========================
   DOM: Kunden-Tab
   ========================= */

const restNameInput = document.getElementById("restNameInput");
const ownerNameInput = document.getElementById("ownerNameInput");
const restCityInput = document.getElementById("restCityInput");
const tableCountInput = document.getElementById("tableCountInput");
const yearPriceInput = document.getElementById("yearPriceInput");
const phoneInput = document.getElementById("phoneInput");
const logoUrlInput = document.getElementById("logoUrlInput");

const createRestBtn = document.getElementById("createRestBtn");
const adminStatus = document.getElementById("adminStatus");
const restList = document.getElementById("restList");
const searchInput = document.getElementById("searchInput");
const filterActive = document.getElementById("filterActive");

/* =========================
   DOM: Tabs
   ========================= */

const customersTab = document.getElementById("customersTab");
const offersTab = document.getElementById("offersTab");
const tabButtons = document.querySelectorAll(".tab-btn");

/* =========================
   DOM: Angebote-Tab
   ========================= */

const offerRestaurantSelect = document.getElementById("offerRestaurantSelect");
const offersEnabledInput = document.getElementById("offersEnabledInput");

const offerEditorCard = document.getElementById("offerEditorCard");
const offerListCard = document.getElementById("offerListCard");

const offerTitleInput = document.getElementById("offerTitleInput");
const offerPriceInput = document.getElementById("offerPriceInput");
const offerImageInput = document.getElementById("offerImageInput");
const offerDescInput = document.getElementById("offerDescInput");
const offerActiveInput = document.getElementById("offerActiveInput");
const offerAddToCartInput = document.getElementById("offerAddToCartInput");
const offerMenuItemSelect = document.getElementById("offerMenuItemSelect");
const offerSaveBtn = document.getElementById("offerSaveBtn");
const offerNewBtn = document.getElementById("offerNewBtn");
const offerStatus = document.getElementById("offerStatus");
const offerList = document.getElementById("offerList");

/* =========================
   GLOBAL STATE
   ========================= */

const BASE_URL = window.location.origin;

let restaurantsCache = [];            // [{id, data}]
let currentOfferRestaurantId = null;  // Restaurant für Angebote
let currentOfferEditingId = null;     // Angebot im Edit-Modus
let currentOfferMenuItems = [];       // menuItems des aktuellen Restaurants

/* =========================
   HELFER
   ========================= */

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-stellig
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addOneYearISO() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate() + 0).toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysLeft(untilIso) {
  if (!untilIso) return null;
  const today = new Date(todayISO() + "T00:00:00");
  const until = new Date(untilIso + "T00:00:00");
  const diffMs = until - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function isSubscriptionValid(data) {
  if (!data.subscriptionUntil) return true;
  const today = todayISO();
  return data.subscriptionUntil >= today;
}

function getStatusLabel(data) {
  if (data.active === false) return "Gesperrt";
  if (!isSubscriptionValid(data)) return "Abo abgelaufen";
  return "Aktiv";
}

function getStatusBadgeColor(label) {
  switch (label) {
    case "Aktiv":
      return { bg: "#dcfce7", fg: "#15803d" };
    case "Abo abgelaufen":
      return { bg: "#fee2e2", fg: "#b91c1c" };
    case "Gesperrt":
      return { bg: "#e5e7eb", fg: "#374151" };
    default:
      return { bg: "#e5e7eb", fg: "#374151" };
  }
}

/* =========================
   TABS
   ========================= */

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tabTarget;
    tabButtons.forEach((b) => b.classList.remove("tab-btn-active"));
    btn.classList.add("tab-btn-active");

    if (target === "offersTab") {
      customersTab.style.display = "none";
      offersTab.style.display = "block";
    } else {
      customersTab.style.display = "block";
      offersTab.style.display = "none";
    }
  });
});

/* =========================
   KUNDEN – NEUES RESTAURANT
   ========================= */

async function createRestaurant() {
  adminStatus.textContent = "";
  adminStatus.className = "status-text";

  const restaurantName = (restNameInput.value || "").trim();
  const ownerName = (ownerNameInput.value || "").trim();
  const city = (restCityInput.value || "").trim();
  const tableCountStr = (tableCountInput.value || "").trim();
  const yearPriceStr = (yearPriceInput.value || "").trim();
  const phone = (phoneInput.value || "").trim();
  const logoUrl = (logoUrlInput.value || "").trim();

  if (!restaurantName) {
    adminStatus.textContent = "Bitte Restaurant-/Lokalname eingeben.";
    adminStatus.classList.add("status-err");
    return;
  }

  let id = restaurantName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

  const tableCount = tableCountStr ? parseInt(tableCountStr, 10) : 0;
  const yearPrice = yearPriceStr
    ? parseFloat(yearPriceStr.replace(",", "."))
    : 0;

  const waiterCode = generateCode();
  const ownerCode = generateCode();

  const subscriptionStart = todayISO();
  const subscriptionUntil = addOneYearISO();

  try {
    createRestBtn.disabled = true;
    createRestBtn.textContent = "Speichere...";

    const ref = doc(db, "restaurants", id);
    await setDoc(ref, {
      restaurantName,
      ownerName,
      city,
      tableCount: isNaN(tableCount) ? 0 : tableCount,
      yearPrice: isNaN(yearPrice) ? 0 : yearPrice,
      phone,
      logoUrl,
      waiterCode,
      ownerCode,
      active: true,
      offerActive: true, // Angebote standardmäßig aktiv
      createdAt: serverTimestamp(),
      subscriptionStart,
      subscriptionUntil,
    });

    adminStatus.textContent = `Kunde "${restaurantName}" angelegt. Kellner-Code: ${waiterCode}, Admin-Code: ${ownerCode}`;
    adminStatus.classList.add("status-ok");

    restNameInput.value = "";
    ownerNameInput.value = "";
    restCityInput.value = "";
    tableCountInput.value = "";
    yearPriceInput.value = "";
    phoneInput.value = "";
    logoUrlInput.value = "";

    await loadRestaurants();
  } catch (err) {
    console.error(err);
    adminStatus.textContent = "Fehler: " + err.message;
    adminStatus.classList.add("status-err");
  } finally {
    createRestBtn.disabled = false;
    createRestBtn.textContent = "Kunden/Lokal erstellen";
  }
}

/* =========================
   KUNDEN – LISTE LADEN
   ========================= */

async function loadRestaurants() {
  restList.innerHTML = "<div class='info'>Lade...</div>";

  restaurantsCache = [];
  if (offerRestaurantSelect) {
    offerRestaurantSelect.innerHTML = '<option value="">Lokal wählen...</option>';
  }

  const snap = await getDocs(collection(db, "restaurants"));
  restList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
    restaurantsCache.push({ id, data });

    const tables = data.tableCount || 0;

    // yearPrice sauber in Zahl umwandeln
    let yearPriceNum = 0;
    if (typeof data.yearPrice === "number") {
      yearPriceNum = data.yearPrice;
    } else if (typeof data.yearPrice === "string") {
      const parsed = parseFloat(data.yearPrice.replace(",", "."));
      if (!isNaN(parsed)) yearPriceNum = parsed;
    }

    let yearPriceDisplay = "";
    if (yearPriceNum > 0) {
      yearPriceDisplay = " • " + yearPriceNum.toFixed(2) + " €/Jahr";
    }

    const statusLabel = getStatusLabel(data);
    const statusColors = getStatusBadgeColor(statusLabel);
    const aboText = data.subscriptionUntil
      ? (() => {
          const days = daysLeft(data.subscriptionUntil);
          const rest =
            days !== null
              ? ` (noch ${days} Tag${Math.abs(days) === 1 ? "" : "e"})`
              : "";
          return `Abo bis: ${data.subscriptionUntil}${rest}`;
        })()
      : "Abo bis: –";

    const card = document.createElement("div");
    card.className = "card";

    const searchText = [
      data.restaurantName || "",
      data.ownerName || "",
      data.city || "",
      data.phone || "",
      id || "",
    ]
      .join(" ")
      .toLowerCase();

    card.dataset.searchtext = searchText;
    card.dataset.active = statusLabel === "Aktiv" ? "1" : "0";

    card.innerHTML = `
      <div class="list-item-row">
        <span>
          <strong>${data.restaurantName || id}</strong><br/>
          <span class="info">
            Inhaber: ${data.ownerName || "-"}${data.phone ? " • " + data.phone : ""}<br/>
            Ort: ${data.city || "-"}<br/>
            ID: ${id}${tables ? " • Tische: " + tables : ""}${yearPriceDisplay}<br/>
            ${aboText}
          </span>
        </span>
        <span class="badge" style="background:${statusColors.bg}; color:${statusColors.fg};">
          ${statusLabel}
        </span>
      </div>

      <div class="info" style="margin-top:6px;">
        Kellner-Code: ${data.waiterCode || "-"} · Admin-Code: ${data.ownerCode || "-"}
      </div>

      <div class="list" style="margin-top:8px;">
        <button class="btn btn-ghost btn-small" 
                data-action="show-qr" 
                data-id="${id}" 
                data-tables="${tables}">
          QR & Links
        </button>
        <a class="btn btn-primary btn-small" href="admin.html?r=${encodeURIComponent(id)}">
          Speisekarte
        </a>
        <button class="btn btn-ghost btn-small"
                data-action="edit"
                data-id="${id}">
          Bearbeiten
        </button>
        <button class="btn btn-ghost btn-small"
                data-action="toggle-active"
                data-id="${id}">
          ${data.active === false ? "Aktivieren" : "Deaktivieren"}
        </button>
      </div>

      <div class="info" data-qr-block="${id}" style="display:none; margin-top:8px;"></div>
    `;

    restList.appendChild(card);

    // Dropdown im Angebote-Tab füllen
    if (offerRestaurantSelect) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = data.restaurantName
        ? `${data.restaurantName} (${id})`
        : id;
      offerRestaurantSelect.appendChild(opt);
    }
  });

  if (!restList.hasChildNodes()) {
    restList.innerHTML =
      "<div class='info'>Noch keine Kunden/Lokale angelegt.</div>";
  }

  applyFilters();
}

/* =========================
   KUNDEN – QR / TOGGLE / EDIT
   ========================= */

restList.addEventListener("click", async (e) => {
  const qrBtn = e.target.closest("button[data-action='show-qr']");
  if (qrBtn) {
    const id = qrBtn.dataset.id;
    const tables = parseInt(qrBtn.dataset.tables || "0", 10);
    const block = restList.querySelector(`[data-qr-block="${id}"]`);
    if (!block) return;

    if (block.style.display === "none" || block.style.display === "") {
      if (!block.dataset.loaded) {
        let html = "";
        if (!tables) {
          html = "Keine Tische definiert.";
        } else {
          for (let i = 1; i <= tables; i++) {
            const tableId = `T${i}`;
            const link = `${BASE_URL}/karte.html?r=${encodeURIComponent(
              id
            )}&t=${encodeURIComponent(tableId)}`;
            html += `
              <div class="list-item-row" style="align-items:flex-start; margin-bottom:8px;">
                <span>
                  <strong>${tableId}</strong><br/>
                  <a 
                    href="${link}" 
                    target="_blank" 
                    class="info" 
                    style="word-break:break-all; text-decoration:underline;">
                    ${link}
                  </a>
                </span>
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(
                    link
                  )}" 
                  alt="QR ${tableId}" 
                />
              </div>
            `;
          }
        }
        block.innerHTML = html;
        block.dataset.loaded = "1";
      }
      block.style.display = "block";
    } else {
      block.style.display = "none";
    }
    return;
  }

  const editBtn = e.target.closest("button[data-action='edit']");
  if (editBtn) {
    const id = editBtn.dataset.id;
    await editRestaurant(id);
    return;
  }

  const toggleBtn = e.target.closest("button[data-action='toggle-active']");
  if (toggleBtn) {
    const id = toggleBtn.dataset.id;
    await toggleActive(id, toggleBtn);
  }
});

async function toggleActive(id, btn) {
  try {
    btn.disabled = true;
    btn.textContent = "Ändere...";

    const ref = doc(db, "restaurants", id);
    const card = btn.closest(".card");
    const isActive = card?.dataset.active === "1";
    const newActive = !isActive;

    await updateDoc(ref, { active: newActive });

    card.dataset.active = newActive ? "1" : "0";
    const statusLabel = getStatusLabel({ active: newActive, subscriptionUntil: null });
    const colors = getStatusBadgeColor(statusLabel);
    const badge = card.querySelector(".badge");
    if (badge) {
      badge.textContent = statusLabel;
      badge.style.background = colors.bg;
      badge.style.color = colors.fg;
    }
    btn.textContent = newActive ? "Deaktivieren" : "Aktivieren";

    applyFilters();
  } catch (err) {
    console.error(err);
    alert("Fehler beim Aktualisieren: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

// Bearbeiten-Funktion über popups (vorerst beibehalten)
async function editRestaurant(id) {
  try {
    const ref = doc(db, "restaurants", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Kunde/Lokal nicht gefunden.");
      return;
    }
    const data = snap.data();

    let restaurantName = prompt(
      "Restaurant / Lokalname:",
      data.restaurantName || ""
    );
    if (restaurantName === null) return;
    restaurantName = restaurantName.trim();
    if (!restaurantName) {
      alert("Name darf nicht leer sein.");
      return;
    }

    let ownerName = prompt("Inhaber / Kunde:", data.ownerName || "");
    if (ownerName === null) ownerName = data.ownerName || "";
    ownerName = ownerName.trim();

    let city = prompt("Stadt / Ort:", data.city || "");
    if (city === null) city = data.city || "";
    city = city.trim();

    let tableCountStr = prompt(
      "Anzahl Tische:",
      data.tableCount != null ? String(data.tableCount) : ""
    );
    if (tableCountStr === null)
      tableCountStr =
        data.tableCount != null ? String(data.tableCount) : "0";
    const tableCount = tableCountStr.trim()
      ? parseInt(tableCountStr.trim(), 10)
      : 0;

    let yearPriceStr = prompt(
      "Preis pro Jahr (€):",
      data.yearPrice != null ? String(data.yearPrice) : ""
    );
    if (yearPriceStr === null)
      yearPriceStr =
        data.yearPrice != null ? String(data.yearPrice) : "0";
    const yearPrice = yearPriceStr.trim()
      ? parseFloat(yearPriceStr.trim().replace(",", "."))
      : 0;

    let phone = prompt("Telefon:", data.phone || "");
    if (phone === null) phone = data.phone || "";
    phone = phone.trim();

    let logoUrl = prompt("Logo-URL (optional):", data.logoUrl || "");
    if (logoUrl === null) logoUrl = data.logoUrl || "";
    logoUrl = logoUrl.trim();

    await updateDoc(ref, {
      restaurantName,
      ownerName,
      city,
      tableCount: isNaN(tableCount) ? 0 : tableCount,
      yearPrice: isNaN(yearPrice) ? 0 : yearPrice,
      phone,
      logoUrl,
    });

    await loadRestaurants();
    alert("Daten gespeichert.");
  } catch (err) {
    console.error(err);
    alert("Fehler beim Bearbeiten: " + err.message);
  }
}

/* =========================
   FILTER & SUCHE
   ========================= */

function applyFilters() {
  const queryStr = (searchInput.value || "").toLowerCase();
  const onlyActive = filterActive.checked;

  const cards = restList.querySelectorAll(".card");
  cards.forEach((card) => {
    const text = card.dataset.searchtext || "";
    const isActive = card.dataset.active !== "0";

    let visible = true;

    if (onlyActive && !isActive) {
      visible = false;
    }

    if (queryStr && !text.includes(queryStr)) {
      visible = false;
    }

    card.style.display = visible ? "block" : "none";
  });
}

/* =========================
   ANGEBOTE – HILFSFUNKTIONEN
   ========================= */

function resetOfferForm() {
  currentOfferEditingId = null;
  offerTitleInput.value = "";
  offerPriceInput.value = "";
  offerImageInput.value = "";
  offerDescInput.value = "";
  offerActiveInput.checked = true;
  offerAddToCartInput.checked = true;
  if (offerMenuItemSelect) {
    offerMenuItemSelect.value = "";
  }
  offerStatus.textContent = "";
  offerStatus.className = "status-text";
}

async function loadOfferMenuItems(restId) {
  currentOfferMenuItems = [];
  if (!offerMenuItemSelect) return;

  offerMenuItemSelect.innerHTML =
    '<option value="">Ohne Verknüpfung – freies Angebot / Werbung</option>';

  const menuCol = collection(doc(db, "restaurants", restId), "menuItems");
  const snap = await getDocs(menuCol);

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const price =
      typeof d.price === "number" ? d.price.toFixed(2) + " €" : "";
    const label = `[${d.category || "Sonstiges"}] ${d.name || "Produkt"}${
      price ? " – " + price : ""
    }`;

    currentOfferMenuItems.push({
      id: docSnap.id,
      ...d,
    });

    const opt = document.createElement("option");
    opt.value = docSnap.id;
    opt.textContent = label;
    offerMenuItemSelect.appendChild(opt);
  });
}

async function loadOffersForRestaurant(restId) {
  offerList.innerHTML = "<div class='info'>Lade...</div>";

  const offersCol = collection(doc(db, "restaurants", restId), "offers");
  const snap = await getDocs(offersCol);

  offerList.innerHTML = "";
  if (snap.empty) {
    offerList.innerHTML = "<div class='info'>Noch keine Angebote.</div>";
    offerListCard.style.display = "block";
    return;
  }

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const active = d.active !== false;
    const statusText = active ? "Aktiv" : "Inaktiv";
    const priceText =
      typeof d.price === "number" ? d.price.toFixed(2) + " €" : "";
    const addToCartText = d.addToCart ? "Bestellbar" : "Nur Info";
    const linkedText = d.menuItemId
      ? "Verknüpft mit Speisekarte"
      : "Eigenes Angebot";

    const row = document.createElement("div");
    row.className = "list-item-row";
    row.innerHTML = `
      <span>
        <strong>${d.title || "(ohne Titel)"}</strong><br/>
        <span class="info">
          ${priceText ? priceText + " • " : ""}${addToCartText} • ${linkedText}<br/>
          ${d.description || ""}
        </span>
      </span>
      <span style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">
        <span class="badge" style="margin-bottom:4px;">${statusText}</span>
        <button class="btn btn-ghost btn-small"
                data-offer-action="edit"
                data-offer-id="${id}">
          Bearbeiten
        </button>
        <button class="btn btn-ghost btn-small"
                data-offer-action="toggle"
                data-offer-id="${id}">
          ${active ? "Deaktivieren" : "Aktivieren"}
        </button>
        <button class="btn btn-ghost btn-small"
                data-offer-action="delete"
                data-offer-id="${id}">
          Löschen
        </button>
      </span>
    `;
    offerList.appendChild(row);
  });

  offerListCard.style.display = "block";
}

/* =========================
   ANGEBOTE – EVENT HANDLING
   ========================= */

offerRestaurantSelect.addEventListener("change", async () => {
  const restId = offerRestaurantSelect.value || null;
  currentOfferRestaurantId = restId;
  resetOfferForm();

  offerEditorCard.style.display = restId ? "block" : "none";
  offerListCard.style.display = restId ? "block" : "none";

  if (!restId) return;

  // Restaurant-Daten holen, um globalen Angebots-Schalter zu setzen
  const ref = doc(db, "restaurants", restId);
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  offersEnabledInput.checked = data.offerActive !== false;

  await loadOfferMenuItems(restId);
  await loadOffersForRestaurant(restId);
});

offersEnabledInput.addEventListener("change", async () => {
  if (!currentOfferRestaurantId) return;
  try {
    const ref = doc(db, "restaurants", currentOfferRestaurantId);
    await updateDoc(ref, { offerActive: offersEnabledInput.checked });
  } catch (err) {
    console.error(err);
    alert("Fehler beim Aktualisieren des Angebots-Status: " + err.message);
  }
});

offerNewBtn.addEventListener("click", () => {
  resetOfferForm();
});

offerSaveBtn.addEventListener("click", async () => {
  offerStatus.textContent = "";
  offerStatus.className = "status-text";

  if (!currentOfferRestaurantId) {
    offerStatus.textContent = "Bitte zuerst ein Lokal wählen.";
    offerStatus.classList.add("status-err");
    return;
  }

  const title = (offerTitleInput.value || "").trim();
  const priceStr = (offerPriceInput.value || "").trim();
  const imageUrl = (offerImageInput.value || "").trim();
  const desc = (offerDescInput.value || "").trim();
  const active = offerActiveInput.checked;
  const addToCart = offerAddToCartInput.checked;
  const menuItemId = offerMenuItemSelect.value || "";

  if (!title) {
    offerStatus.textContent = "Titel ist Pflicht.";
    offerStatus.classList.add("status-err");
    return;
  }

  let price = null;
  if (priceStr) {
    const parsed = parseFloat(priceStr.replace(",", "."));
    if (isNaN(parsed)) {
      offerStatus.textContent = "Preis ist keine gültige Zahl.";
      offerStatus.classList.add("status-err");
      return;
    }
    price = parsed;
  }

  const data = {
    title,
    description: desc,
    imageUrl,
    active,
    addToCart,
    menuItemId: menuItemId || null,
  };
  if (price !== null) data.price = price;
  else data.price = null;

  try {
    offerSaveBtn.disabled = true;
    offerSaveBtn.textContent = "Speichere...";

    const offersCol = collection(
      doc(db, "restaurants", currentOfferRestaurantId),
      "offers"
    );

    if (currentOfferEditingId) {
      await updateDoc(doc(offersCol, currentOfferEditingId), data);
    } else {
      const newRef = await addDoc(offersCol, data);
      currentOfferEditingId = newRef.id;
    }

    offerStatus.textContent = "Angebot gespeichert.";
    offerStatus.classList.add("status-ok");

    await loadOffersForRestaurant(currentOfferRestaurantId);
  } catch (err) {
    console.error(err);
    offerStatus.textContent = "Fehler: " + err.message;
    offerStatus.classList.add("status-err");
  } finally {
    offerSaveBtn.disabled = false;
    offerSaveBtn.textContent = "Angebot speichern";
  }
});

offerList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-offer-action]");
  if (!btn || !currentOfferRestaurantId) return;

  const action = btn.dataset.offerAction;
  const id = btn.dataset.offerId;
  const offerRef = doc(
    db,
    "restaurants",
    currentOfferRestaurantId,
    "offers",
    id
  );

  try {
    if (action === "delete") {
      if (!confirm("Dieses Angebot wirklich löschen?")) return;
      await deleteDoc(offerRef);
      await loadOffersForRestaurant(currentOfferRestaurantId);
    } else if (action === "toggle") {
      const snap = await getDoc(offerRef);
      if (!snap.exists()) return;
      const d = snap.data();
      const newActive = d.active === false;
      await updateDoc(offerRef, { active: newActive });
      await loadOffersForRestaurant(currentOfferRestaurantId);
    } else if (action === "edit") {
      const snap = await getDoc(offerRef);
      if (!snap.exists()) return;
      const d = snap.data();
      currentOfferEditingId = id;
      offerTitleInput.value = d.title || "";
      offerPriceInput.value =
        typeof d.price === "number" ? String(d.price) : "";
      offerImageInput.value = d.imageUrl || "";
      offerDescInput.value = d.description || "";
      offerActiveInput.checked = d.active !== false;
      offerAddToCartInput.checked = d.addToCart === true;
      offerMenuItemSelect.value = d.menuItemId || "";
      offerStatus.textContent = "Angebot im Bearbeitungsmodus.";
      offerStatus.className = "status-text";
    }
  } catch (err) {
    console.error(err);
    alert("Fehler bei Angebot: " + err.message);
  }
});

/* =========================
   EVENTS & INIT
   ========================= */

createRestBtn.addEventListener("click", createRestaurant);
searchInput.addEventListener("input", applyFilters);
filterActive.addEventListener("change", applyFilters);

loadRestaurants();
