import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
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

const BASE_URL = window.location.origin;

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
  const yearPrice = yearPriceStr ? parseFloat(yearPriceStr.replace(",", ".")) : 0;

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
    const yearPrice = data.yearPrice || 0;
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
            Inhaber: ${data.ownerName || "-"}${
      data.phone ? " • " + data.phone : ""
    }<br/>
            Ort: ${data.city || "-"}<br/>
            ID: ${id}${tables ? " • Tische: " + tables : ""}${
      yearPrice ? " • " + yearPrice.toFixed(2) + " €/Jahr" : ""
    }<br/>
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
    restList.innerHTML = "<div class='info'>Noch keine Kunden/Lokale angelegt.</div>";
  }

  applyFilters();
}

// QR-Block ein-/ausblenden und klickbare Links + QR-Codes erzeugen
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
    const statusLabel = newActive ? "Aktiv" : "Gesperrt";
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

// Filter & Suche anwenden
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
