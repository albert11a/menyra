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

// Detail-Bereich
const restDetailCard = document.getElementById("restDetailCard");
const detailTitle = document.getElementById("detailTitle");
const detailSubtitle = document.getElementById("detailSubtitle");
const detailStatusBadge = document.getElementById("detailStatusBadge");
const detailAboInfo = document.getElementById("detailAboInfo");

const detailTabs = document.getElementById("detailTabs");
const tabInfo = document.getElementById("tab-info");
const tabMenu = document.getElementById("tab-menu");
const tabOffers = document.getElementById("tab-offers");

const detailNameInput = document.getElementById("detailNameInput");
const detailOwnerInput = document.getElementById("detailOwnerInput");
const detailCityInput = document.getElementById("detailCityInput");
const detailPhoneInput = document.getElementById("detailPhoneInput");
const detailTableCountInput = document.getElementById("detailTableCountInput");
const detailYearPriceInput = document.getElementById("detailYearPriceInput");
const detailLogoUrlInput = document.getElementById("detailLogoUrlInput");
const detailCodesInfo = document.getElementById("detailCodesInfo");
const detailSaveBtn = document.getElementById("detailSaveBtn");
const detailInfoStatus = document.getElementById("detailInfoStatus");

const detailMenuList = document.getElementById("detailMenuList");
const detailOpenAdminLink = document.getElementById("detailOpenAdminLink");

const offersEnabledInput = document.getElementById("offersEnabledInput");
const addOfferBtn = document.getElementById("addOfferBtn");
const offersStatus = document.getElementById("offersStatus");
const offersList = document.getElementById("offersList");

const BASE_URL = window.location.origin;

let currentRestaurantId = null;
let currentRestaurantData = null;

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
  const day = String(d.getDate()).padStart(2, "0");
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
      createdAt: serverTimestamp(),
      subscriptionStart,
      subscriptionUntil,
      offersEnabled: true, // Angebote standardmäßig aktiv
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

async function loadRestaurants() {
  restList.innerHTML = "<div class='info'>Lade...</div>";
  const snap = await getDocs(collection(db, "restaurants"));

  restList.innerHTML = "";

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;
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
        <button class="btn btn-primary btn-small" 
                data-action="details" 
                data-id="${id}">
          Details
        </button>
        <button class="btn btn-ghost btn-small" 
                data-action="show-qr" 
                data-id="${id}" 
                data-tables="${tables}">
          QR & Links
        </button>
        <a class="btn btn-ghost btn-small" href="admin.html?r=${encodeURIComponent(id)}">
          Speisekarte
        </a>
        <button class="btn btn-ghost btn-small"
                data-action="toggle-active"
                data-id="${id}">
          ${data.active === false ? "Aktivieren" : "Deaktivieren"}
        </button>
      </div>

      <div class="info" data-qr-block="${id}" style="display:none; margin-top:8px;"></div>
    `;

    restList.appendChild(card);
  });

  if (!restList.hasChildNodes()) {
    restList.innerHTML =
      "<div class='info'>Noch keine Kunden/Lokale angelegt.</div>";
  }

  applyFilters();
}

// QR-Block / Details / Aktiv-Status
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

  const detailBtn = e.target.closest("button[data-action='details']");
  if (detailBtn) {
    const id = detailBtn.dataset.id;
    await openDetailsForRestaurant(id);
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

    // Liste aktualisieren
    await loadRestaurants();

    // Detailbereich neu laden, wenn dieser Kunde aktiv ist
    if (currentRestaurantId === id) {
      await openDetailsForRestaurant(id);
    }
  } catch (err) {
    console.error(err);
    alert("Fehler beim Aktualisieren: " + err.message);
  } finally {
    btn.disabled = false;
  }
}

/* ================================
   DETAIL: Tabs
   ================================ */

detailTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".detail-tab");
  if (!btn) return;

  const tab = btn.dataset.tab;
  const allTabs = detailTabs.querySelectorAll(".detail-tab");
  allTabs.forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });

  tabInfo.style.display = tab === "info" ? "block" : "none";
  tabMenu.style.display = tab === "menu" ? "block" : "none";
  tabOffers.style.display = tab === "offers" ? "block" : "none";
});

async function openDetailsForRestaurant(id) {
  try {
    const ref = doc(db, "restaurants", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      alert("Kunde/Lokal nicht gefunden.");
      return;
    }
    currentRestaurantId = id;
    currentRestaurantData = snap.data();

    const data = currentRestaurantData;

    detailTitle.textContent = data.restaurantName || id;
    detailSubtitle.textContent = `${data.city || "-"} • ID: ${id}`;

    const statusLabel = getStatusLabel(data);
    const colors = getStatusBadgeColor(statusLabel);
    detailStatusBadge.textContent = statusLabel;
    detailStatusBadge.style.background = colors.bg;
    detailStatusBadge.style.color = colors.fg;

    if (data.subscriptionUntil) {
      const days = daysLeft(data.subscriptionUntil);
      const rest =
        days !== null
          ? ` (noch ${days} Tag${Math.abs(days) === 1 ? "" : "e"})`
          : "";
      detailAboInfo.textContent = `Abo bis: ${data.subscriptionUntil}${rest}`;
    } else {
      detailAboInfo.textContent = "Abo bis: –";
    }

    // Info-Felder
    detailNameInput.value = data.restaurantName || "";
    detailOwnerInput.value = data.ownerName || "";
    detailCityInput.value = data.city || "";
    detailPhoneInput.value = data.phone || "";
    detailTableCountInput.value =
      data.tableCount != null ? String(data.tableCount) : "";
    detailYearPriceInput.value =
      data.yearPrice != null ? String(data.yearPrice) : "";
    detailLogoUrlInput.value = data.logoUrl || "";

    detailCodesInfo.textContent = `Kellner-Code: ${
      data.waiterCode || "-"
    } · Admin-Code: ${data.ownerCode || "-"}`;

    detailOpenAdminLink.href = `admin.html?r=${encodeURIComponent(id)}`;

    detailInfoStatus.textContent = "";
    detailInfoStatus.className = "status-text";

    // Standard-Tab: Info
    const allTabs = detailTabs.querySelectorAll(".detail-tab");
    allTabs.forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === "info")
    );
    tabInfo.style.display = "block";
    tabMenu.style.display = "none";
    tabOffers.style.display = "none";

    restDetailCard.style.display = "block";
    restDetailCard.scrollIntoView({ behavior: "smooth", block: "start" });

    // Menü & Angebote laden
    await loadDetailMenu();
    await loadOffers();
  } catch (err) {
    console.error(err);
    alert("Fehler beim Laden der Details: " + err.message);
  }
}

/* ================================
   DETAIL: Info speichern
   ================================ */

detailSaveBtn.addEventListener("click", async () => {
  if (!currentRestaurantId) return;

  detailInfoStatus.textContent = "";
  detailInfoStatus.className = "status-text";

  let restaurantName = (detailNameInput.value || "").trim();
  let ownerName = (detailOwnerInput.value || "").trim();
  let city = (detailCityInput.value || "").trim();
  let phone = (detailPhoneInput.value || "").trim();
  let tableCountStr = (detailTableCountInput.value || "").trim();
  let yearPriceStr = (detailYearPriceInput.value || "").trim();
  let logoUrl = (detailLogoUrlInput.value || "").trim();

  if (!restaurantName) {
    detailInfoStatus.textContent = "Name darf nicht leer sein.";
    detailInfoStatus.classList.add("status-err");
    return;
  }

  const tableCount = tableCountStr ? parseInt(tableCountStr, 10) : 0;
  const yearPrice = yearPriceStr
    ? parseFloat(yearPriceStr.replace(",", "."))
    : 0;

  try {
    detailSaveBtn.disabled = true;
    detailSaveBtn.textContent = "Speichere...";

    const ref = doc(db, "restaurants", currentRestaurantId);
    await updateDoc(ref, {
      restaurantName,
      ownerName,
      city,
      tableCount: isNaN(tableCount) ? 0 : tableCount,
      yearPrice: isNaN(yearPrice) ? 0 : yearPrice,
      phone,
      logoUrl,
    });

    detailInfoStatus.textContent = "Gespeichert.";
    detailInfoStatus.classList.add("status-ok");

    await loadRestaurants();
    await openDetailsForRestaurant(currentRestaurantId);
  } catch (err) {
    console.error(err);
    detailInfoStatus.textContent = "Fehler: " + err.message;
    detailInfoStatus.classList.add("status-err");
  } finally {
    detailSaveBtn.disabled = false;
    detailSaveBtn.textContent = "Änderungen speichern";
  }
});

/* ================================
   DETAIL: Menü-Verwaltung
   ================================ */

async function loadDetailMenu() {
  detailMenuList.innerHTML = "<div class='info'>Lade Speisekarte...</div>";

  if (!currentRestaurantId) return;

  const menuCol = collection(
    doc(db, "restaurants", currentRestaurantId),
    "menuItems"
  );
  const snap = await getDocs(menuCol);

  detailMenuList.innerHTML = "";

  if (snap.empty) {
    detailMenuList.innerHTML =
      "<div class='info'>Noch keine Speisekarte angelegt.</div>";
    return;
  }

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;
    const available = d.available !== false;
    const price =
      typeof d.price === "number" ? d.price.toFixed(2) + " €" : String(d.price || "-");
    const desc = d.description || "";

    const row = document.createElement("div");
    row.className = "menu-admin-row";

    row.innerHTML = `
      <div class="list-item-row">
        <span>
          <strong>[${d.category || "Sonstiges"}]</strong> ${d.name || "Produkt"}<br/>
          <span class="info">
            ${price}${desc ? " • " + desc : ""} • Status: ${
      available ? "aktiv" : "inaktiv"
    }
          </span>
        </span>
        <span style="display:flex; gap:6px;">
          <button class="btn btn-ghost btn-small"
                  data-menu-id="${id}"
                  data-action="menu-toggle"
                  data-available="${available ? "1" : "0"}">
            ${available ? "Deaktivieren" : "Aktivieren"}
          </button>
          <button class="btn btn-ghost btn-small"
                  data-menu-id="${id}"
                  data-action="menu-edit">
            Bearbeiten
          </button>
          <button class="btn btn-ghost btn-small"
                  data-menu-id="${id}"
                  data-action="menu-delete">
            Löschen
          </button>
        </span>
      </div>
    `;

    detailMenuList.appendChild(row);
  });
}

detailMenuList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-menu-id]");
  if (!btn || !currentRestaurantId) return;

  const id = btn.dataset.menuId;
  const action = btn.dataset.action;

  const menuRef = doc(
    db,
    "restaurants",
    currentRestaurantId,
    "menuItems",
    id
  );

  if (action === "menu-toggle") {
    const isActive = btn.dataset.available === "1";
    await updateDoc(menuRef, { available: !isActive });
    await loadDetailMenu();
  } else if (action === "menu-edit") {
    const snap = await getDoc(menuRef);
    if (!snap.exists()) {
      alert("Gericht nicht gefunden.");
      return;
    }
    const d = snap.data();

    let name = prompt("Name des Gerichts:", d.name || "");
    if (name === null) return;
    name = name.trim();
    if (!name) {
      alert("Name darf nicht leer sein.");
      return;
    }

    let category = prompt("Kategorie:", d.category || "");
    if (category === null) category = d.category || "";
    category = category.trim();

    let priceStr = prompt(
      "Preis:",
      d.price != null ? String(d.price) : ""
    );
    if (priceStr === null)
      priceStr = d.price != null ? String(d.price) : "0";
    const price = priceStr.trim()
      ? parseFloat(priceStr.trim().replace(",", "."))
      : 0;

    let desc = prompt("Beschreibung:", d.description || "");
    if (desc === null) desc = d.description || "";
    desc = desc.trim();

    await updateDoc(menuRef, {
      name,
      category,
      price: isNaN(price) ? 0 : price,
      description: desc,
    });

    await loadDetailMenu();
  } else if (action === "menu-delete") {
    if (!confirm("Dieses Gericht wirklich löschen?")) return;
    await deleteDoc(menuRef);
    await loadDetailMenu();
  }
});

/* ================================
   DETAIL: Angebote
   ================================ */

async function loadOffers() {
  offersStatus.textContent = "";
  offersStatus.className = "status-text";
  offersList.innerHTML = "<div class='info'>Lade Angebote...</div>";

  if (!currentRestaurantId || !currentRestaurantData) {
    offersList.innerHTML = "";
    return;
  }

  const enabled = currentRestaurantData.offersEnabled !== false;
  offersEnabledInput.checked = enabled;

  const offersCol = collection(
    doc(db, "restaurants", currentRestaurantId),
    "offers"
  );
  const snap = await getDocs(offersCol);

  offersList.innerHTML = "";

  if (snap.empty) {
    offersList.innerHTML =
      "<div class='info'>Noch keine Angebote angelegt.</div>";
    return;
  }

  const offers = snap.docs.map((d) => {
    const data = d.data();

    let priceNum = 0;
    if (typeof data.price === "number") {
      priceNum = data.price;
    } else if (typeof data.price === "string") {
      const parsed = parseFloat(data.price.replace(",", "."));
      if (!isNaN(parsed)) priceNum = parsed;
    }

    return {
      id: d.id,
      title: data.title || "",
      text: data.text || "",
      imageUrl: data.imageUrl || "",
      active: data.active !== false,
      sortOrder: data.sortOrder || 0,
      price: priceNum,
    };
  });

  offers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  offers.forEach((o) => {
    const card = document.createElement("div");
    card.className = "card offer-admin-card";
    const statusLabel = o.active ? "Aktiv" : "Inaktiv";
    const colors = o.active
      ? { bg: "#dcfce7", fg: "#15803d" }
      : { bg: "#e5e7eb", fg: "#374151" };

    const priceText =
      o.price && !isNaN(o.price) && o.price > 0
        ? ` • ${o.price.toFixed(2)} €`
        : "";

    card.innerHTML = `
      <div class="list-item-row">
        <span>
          <strong>${o.title || "(ohne Titel)"}</strong><br/>
          <span class="info">${o.text || ""}${priceText}</span>
        </span>
        <span class="badge" style="background:${colors.bg}; color:${colors.fg};">
          ${statusLabel}
        </span>
      </div>
      ${
        o.imageUrl
          ? `<img src="${o.imageUrl}" alt="Angebot" style="margin-top:6px;"/>`
          : ""
      }
      <div class="list" style="margin-top:8px;">
        <button class="btn btn-ghost btn-small"
                data-offer-id="${o.id}"
                data-action="offer-edit">
          Bearbeiten
        </button>
        <button class="btn btn-ghost btn-small"
                data-offer-id="${o.id}"
                data-action="offer-toggle">
          ${o.active ? "Deaktivieren" : "Aktivieren"}
        </button>
        <button class="btn btn-ghost btn-small"
                data-offer-id="${o.id}"
                data-action="offer-delete">
          Löschen
        </button>
      </div>
    `;

    offersList.appendChild(card);
  });
}

offersEnabledInput.addEventListener("change", async () => {
  if (!currentRestaurantId) return;
  const enabled = offersEnabledInput.checked;

  try {
    await updateDoc(doc(db, "restaurants", currentRestaurantId), {
      offersEnabled: enabled,
    });
    currentRestaurantData.offersEnabled = enabled;
    offersStatus.textContent = enabled
      ? "Angebote aktiviert."
      : "Angebote komplett deaktiviert.";
    offersStatus.className = "status-text status-ok";
  } catch (err) {
    console.error(err);
    offersStatus.textContent = "Fehler: " + err.message;
    offersStatus.className = "status-text status-err";
  }
});

addOfferBtn.addEventListener("click", async () => {
  if (!currentRestaurantId) return;

  let title = prompt("Titel des Angebots:");
  if (title === null) return;
  title = title.trim();

  let text = prompt("Beschreibung / Text:");
  if (text === null) text = "";
  text = text.trim();

  let imageUrl = prompt("Bild-URL (optional):");
  if (imageUrl === null) imageUrl = "";
  imageUrl = imageUrl.trim();

  let priceStr = prompt("Preis (€, optional):", "");
  let priceNum = 0;
  if (priceStr !== null) {
    priceStr = priceStr.trim();
    if (priceStr) {
      const parsed = parseFloat(priceStr.replace(",", "."));
      if (!isNaN(parsed)) priceNum = parsed;
    }
  }

  try {
    const offersCol = collection(
      doc(db, "restaurants", currentRestaurantId),
      "offers"
    );
    await addDoc(offersCol, {
      title,
      text,
      imageUrl,
      price: priceNum,
      active: true,
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
    });

    await loadOffers();
  } catch (err) {
    console.error(err);
    alert("Fehler beim Anlegen des Angebots: " + err.message);
  }
});

offersList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-offer-id]");
  if (!btn || !currentRestaurantId) return;

  const offerId = btn.dataset.offerId;
  const action = btn.dataset.action;

  const offerRef = doc(
    db,
    "restaurants",
    currentRestaurantId,
    "offers",
    offerId
  );

  if (action === "offer-delete") {
    if (!confirm("Dieses Angebot wirklich löschen?")) return;
    await deleteDoc(offerRef);
    await loadOffers();
  } else if (action === "offer-toggle") {
    const snap = await getDoc(offerRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const active = data.active !== false;
    await updateDoc(offerRef, { active: !active });
    await loadOffers();
  } else if (action === "offer-edit") {
    const snap = await getDoc(offerRef);
    if (!snap.exists()) return;
    const data = snap.data();

    let title = prompt("Titel des Angebots:", data.title || "");
    if (title === null) return;
    title = title.trim();

    let text = prompt("Beschreibung / Text:", data.text || "");
    if (text === null) text = data.text || "";
    text = text.trim();

    let imageUrl = prompt("Bild-URL (optional):", data.imageUrl || "");
    if (imageUrl === null) imageUrl = data.imageUrl || "";
    imageUrl = imageUrl.trim();

    let priceStr = prompt(
      "Preis (€, optional):",
      data.price != null ? String(data.price) : ""
    );
    let priceNum = 0;
    if (priceStr !== null) {
      priceStr = priceStr.trim();
      if (priceStr) {
        const parsed = parseFloat(priceStr.replace(",", "."));
        if (!isNaN(parsed)) priceNum = parsed;
      }
    }

    await updateDoc(offerRef, {
      title,
      text,
      imageUrl,
      price: priceNum,
    });

    await loadOffers();
  }
});

/* ================================
   Filter & Suche
   ================================ */

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

createRestBtn.addEventListener("click", createRestaurant);
searchInput.addEventListener("input", applyFilters);
filterActive.addEventListener("change", applyFilters);

loadRestaurants();
