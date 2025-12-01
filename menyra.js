import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const customerNameInput = document.getElementById("customerNameInput");
const restNameInput = document.getElementById("restNameInput");
const restCityInput = document.getElementById("restCityInput");
const restIdInput = document.getElementById("restIdInput");
const tableCountInput = document.getElementById("tableCountInput");
const yearPriceInput = document.getElementById("yearPriceInput");
const contactEmailInput = document.getElementById("contactEmailInput");
const contactPhoneInput = document.getElementById("contactPhoneInput");

const createRestBtn = document.getElementById("createRestBtn");
const adminStatus = document.getElementById("adminStatus");
const restList = document.getElementById("restList");

// Basis-URL (lokal: http://127.0.0.1:5500, später deine Domain)
const BASE_URL = window.location.origin;

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-stellig
}

async function createRestaurant() {
  adminStatus.textContent = "";
  adminStatus.className = "status-text";

  const customerName = (customerNameInput.value || "").trim();
  const restaurantName = (restNameInput.value || "").trim();
  const city = (restCityInput.value || "").trim();
  let id = (restIdInput.value || "").trim();
  const tableCountStr = (tableCountInput.value || "").trim();
  const yearPriceStr = (yearPriceInput.value || "").trim();
  const contactEmail = (contactEmailInput.value || "").trim();
  const contactPhone = (contactPhoneInput.value || "").trim();

  if (!restaurantName) {
    adminStatus.textContent = "Bitte Restaurant-/Lokalname eingeben.";
    adminStatus.classList.add("status-err");
    return;
  }

  if (!id) {
    // einfache ID aus Restaurantname bauen
    id = restaurantName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");
  }

  const tableCount = tableCountStr ? parseInt(tableCountStr, 10) : 0;
  const yearPrice = yearPriceStr ? parseFloat(yearPriceStr.replace(",", ".")) : 0;

  const waiterCode = generateCode();
  const ownerCode = generateCode();

  try {
    createRestBtn.disabled = true;
    createRestBtn.textContent = "Speichere...";

    const ref = doc(db, "restaurants", id);
    await setDoc(ref, {
      customerName,
      restaurantName,
      city,
      tableCount: isNaN(tableCount) ? 0 : tableCount,
      yearPrice: isNaN(yearPrice) ? 0 : yearPrice,
      contactEmail,
      contactPhone,
      waiterCode,
      ownerCode,
      active: true,
      createdAt: serverTimestamp(),
    });

    adminStatus.textContent = `Kunde "${restaurantName}" angelegt. Kellner-Code: ${waiterCode}, Admin-Code: ${ownerCode}`;
    adminStatus.classList.add("status-ok");

    // Felder leeren
    customerNameInput.value = "";
    restNameInput.value = "";
    restCityInput.value = "";
    restIdInput.value = "";
    tableCountInput.value = "";
    yearPriceInput.value = "";
    contactEmailInput.value = "";
    contactPhoneInput.value = "";

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

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="list-item-row">
        <span>
          <strong>${data.restaurantName || id}</strong><br/>
          <span class="info">
            Kunde: ${data.customerName || "-"}${data.city ? " • " + data.city : ""}<br/>
            ID: ${id}${tables ? " • Tische: " + tables : ""}${
      yearPrice ? " • " + yearPrice.toFixed(2) + " €/Jahr" : ""
    }
          </span>
        </span>
        <span class="badge">${data.active ? "Aktiv" : "Inaktiv"}</span>
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
          Speisekarte bearbeiten
        </a>
      </div>
      <div class="info" data-qr-block="${id}" style="display:none; margin-top:8px;"></div>
    `;

    restList.appendChild(card);
  });

  if (!restList.hasChildNodes()) {
    restList.innerHTML = "<div class='info'>Noch keine Kunden/Lokale angelegt.</div>";
  }
}

// QR-Block ein-/ausblenden und klickbare Links + QR-Codes erzeugen
restList.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='show-qr']");
  if (!btn) return;

  const id = btn.dataset.id;
  const tables = parseInt(btn.dataset.tables || "0", 10);
  const block = restList.querySelector(`[data-qr-block="${id}"]`);
  if (!block) return;

  if (block.style.display === "none" || block.style.display === "") {
    // erstmalig generieren
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
});

createRestBtn.addEventListener("click", createRestaurant);
loadRestaurants();
