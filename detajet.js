// detajet.js – Produkt-Details-Ansicht für Gäste

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// ==============================
// URL-PARAMETER LESEN
// ==============================

const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";
const itemId = params.get("item");

// ==============================
// DOM-REFERENZEN
// ==============================

const backBtn = document.getElementById("backBtn");
const detailTableBadge = document.getElementById("detailTableBadge");

const detailImage = document.getElementById("detailImage");
const detailName = document.getElementById("detailName");
const detailPrice = document.getElementById("detailPrice");
const detailLongDesc = document.getElementById("detailLongDesc");
const detailZutaten = document.getElementById("detailZutaten");
const detailRating = document.getElementById("detailRating");
const detailLikeBtn = document.getElementById("detailLikeBtn");

const detailQtyMinus = document.getElementById("detailQtyMinus");
const detailQtyPlus = document.getElementById("detailQtyPlus");
const detailQtyValue = document.getElementById("detailQtyValue");
const detailAddBtn = document.getElementById("detailAddBtn");
const detailViewCartBtn = document.getElementById("detailViewCartBtn");

const detailCartSection = document.getElementById("detailCartSection");
const detailCartTableLabel = document.getElementById("detailCartTableLabel");
const detailCartItems = document.getElementById("detailCartItems");
const detailCartTotal = document.getElementById("detailCartTotal");

const cartFab = document.getElementById("cartFab");
const cartBadgeEl = document.getElementById("cartBadge");
const cartFabLabel = document.getElementById("cartFabLabel");

// ==============================
// LOKALER STATE
// ==============================

let currentItem = null;   // geladenes Produkt
let qty = 1;              // aktuelle Menge im Detail
let cartQtyTotal = 0;     // Summe aller Stücke in dieser Detail-Seite
let cartTotalPrice = 0;   // Summe Preise (nur dieses Produkt)

// ==============================
// HILFSFUNKTIONEN
// ==============================

function formatPrice(value) {
  if (typeof value !== "number" || isNaN(value)) return "0.00 €";
  return value.toFixed(2) + " €";
}

function updateQtyDisplay() {
  if (qty < 1) qty = 1;
  detailQtyValue.textContent = String(qty);
}

function updateCartUI() {
  if (!currentItem || cartQtyTotal <= 0) {
    detailCartSection.style.display = "none";
    cartBadgeEl.style.display = "none";
    cartFab.classList.remove("visible");
    cartFab.classList.remove("cart-fab--has-items");
    return;
  }

  // Mini-Shporta anzeigen
  detailCartSection.style.display = "block";

  detailCartItems.innerHTML = "";
  const row = document.createElement("div");
  row.className = "cart-item-row";
  row.innerHTML = `
    <span>${cartQtyTotal}× ${currentItem.name}</span>
    <span>${formatPrice(cartTotalPrice)}</span>
  `;
  detailCartItems.appendChild(row);

  detailCartTotal.textContent = `Shuma: ${formatPrice(cartTotalPrice)}`;

  // FAB aktualisieren
  cartBadgeEl.textContent = String(cartQtyTotal);
  cartBadgeEl.style.display = "flex";
  cartFab.classList.add("visible");
  cartFab.classList.add("cart-fab--has-items");
}

// ==============================
// DATEN LADEN
// ==============================

async function loadItemDetails() {
  try {
    if (!itemId) {
      detailName.textContent = "Produkti nuk u gjet";
      detailLongDesc.textContent = "Mungon ID e produktit në URL.";
      return;
    }

    // Tisch-Badge setzen
    if (tableId) {
      detailTableBadge.textContent = `Tavolina ${tableId}`;
      detailCartTableLabel.textContent = `Tavolina ${tableId}`;
    } else {
      detailTableBadge.textContent = "Tavolina ?";
    }

    // Produkt-Dokument holen: restaurants/{restaurantId}/menuItems/{itemId}
    const itemRef = doc(db, "restaurants", restaurantId, "menuItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      detailName.textContent = "Produkti nuk ekziston";
      detailLongDesc.textContent =
        "Ju lutemi kontaktoni stafin – ky produkt nuk u gjet në meny.";
      return;
    }

    const d = itemSnap.data();
    currentItem = {
      id: itemSnap.id,
      name: d.name || "Produkt pa emër",
      price: typeof d.price === "number" ? d.price : 0,
      imageUrl: d.imageUrl || null,
      description: d.description || "",
      longDescription: d.longDescription || "",  // opsional në DB
      ingredients: d.ingredients || "",          // opsional në DB
    };

    // Bild
    if (currentItem.imageUrl) {
      detailImage.src = currentItem.imageUrl;
      detailImage.style.display = "block";
    } else {
      detailImage.src = "";
      detailImage.style.display = "none";
    }

    // Name / Preis
    detailName.textContent = currentItem.name;
    detailPrice.textContent = formatPrice(currentItem.price);

    // Beschreibung & Zutaten
    const longText =
      currentItem.longDescription || currentItem.description || "";
    detailLongDesc.textContent = longText || "Asnjë përshkrim i shtuar.";

    if (currentItem.ingredients) {
      detailZutaten.textContent = "Përbërësit: " + currentItem.ingredients;
    } else {
      detailZutaten.textContent = "Përbërësit: —";
    }

    // Rating aktuell nur statisch
    detailRating.textContent = "⭐️ 5.0 · 0 vlerësime";

  } catch (err) {
    console.error("Fehler beim Laden der Produktdetails:", err);
    detailName.textContent = "Gabim";
    detailLongDesc.textContent =
      "Ndodhi një gabim gjatë ngarkimit të produktit. Ju lutem provoni përsëri.";
  }
}

// ==============================
// EVENT-LISTENER
// ==============================

// Back-Button → zurück zur vorherigen Seite (normalerweise karte.html)
backBtn.addEventListener("click", () => {
  // wenn kein history vorhanden ist, fallback auf karte.html
  if (window.history.length > 1) {
    history.back();
  } else {
    const url = new URL(window.location.href);
    url.pathname = "karte.html";
    url.searchParams.set("r", restaurantId);
    url.searchParams.set("t", tableId);
    window.location.href = url.toString();
  }
});

// Menge +
detailQtyPlus.addEventListener("click", () => {
  qty += 1;
  updateQtyDisplay();
});

// Menge -
detailQtyMinus.addEventListener("click", () => {
  if (qty > 1) {
    qty -= 1;
    updateQtyDisplay();
  }
});

// „Shto në porosi“ – nur lokaler Mini-Warenkorb in dieser Detail-Seite
detailAddBtn.addEventListener("click", () => {
  if (!currentItem) return;
  if (qty < 1) qty = 1;

  cartQtyTotal += qty;
  cartTotalPrice = cartQtyTotal * (currentItem.price || 0);

  updateCartUI();
});

// „Shiko porosin“ → zur Mini-Shporta unten scrollen
detailViewCartBtn.addEventListener("click", () => {
  if (detailCartSection.style.display !== "none") {
    detailCartSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// Floating Cart FAB → ebenfalls zur Mini-Shporta scrollen
cartFab.addEventListener("click", () => {
  if (detailCartSection.style.display !== "none") {
    detailCartSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});

// Like-Button aktuell nur visuelles Toggle
detailLikeBtn.addEventListener("click", () => {
  const active = detailLikeBtn.classList.toggle("social-btn-like--active");
  detailLikeBtn.textContent = active ? "❤️ E pëlqyer" : "❤️ Pëlqeje";
});

// ==============================
// INITIAL START
// ==============================

updateQtyDisplay();
updateCartUI();
loadItemDetails();
