// detajet.js – Detailseite für ein Produkt, nutzt globalen Cart + Porosia-Seite

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// URL-Parameter lesen
const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";
const itemId = params.get("item");

// DOM-Referenzen
const backBtn = document.getElementById("backBtn");
const detailTableBadge = document.getElementById("detailTableBadge");

const detailImageEl = document.getElementById("detailImage");
const detailNameEl = document.getElementById("detailName");
const detailPriceEl = document.getElementById("detailPrice");
const detailLongDescEl = document.getElementById("detailLongDesc");
const detailZutatenEl = document.getElementById("detailZutaten");

const detailRatingEl = document.getElementById("detailRating");
const detailLikeBtn = document.getElementById("detailLikeBtn");

const detailQtyMinusBtn = document.getElementById("detailQtyMinus");
const detailQtyPlusBtn = document.getElementById("detailQtyPlus");
const detailQtyValueEl = document.getElementById("detailQtyValue");
const detailAddBtn = document.getElementById("detailAddBtn");
const detailViewCartBtn = document.getElementById("detailViewCartBtn");

// Mini-Cart in Detajet (unter der Card)
const detailCartSection = document.getElementById("detailCartSection");
const detailCartTableLabel = document.getElementById("detailCartTableLabel");
const detailCartItemsEl = document.getElementById("detailCartItems");
const detailCartTotalEl = document.getElementById("detailCartTotal");

// Floating Cart Button wie auf Karte
const cartFab = document.getElementById("cartFab");
const cartFabLabel = document.getElementById("cartFabLabel");
const cartBadgeEl = document.getElementById("cartBadge");

// State
let cart = [];
let currentItem = null;
let currentQty = 1;

/* =========================
   CART: LOCALSTORAGE (gleich wie in karte.js)
   ========================= */

function getCartStorageKey() {
  return `menyra_cart_${restaurantId}_${tableId}`;
}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(getCartStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: item.id,
        name: item.name,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 0,
      }))
      .filter((i) => i.qty > 0);
  } catch {
    return [];
  }
}

function saveCartToStorage() {
  try {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(cart));
  } catch {
    // ignore
  }
}

/* =========================
   CART-UI: FAB + Mini-Cart
   ========================= */

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  if (totalQty > 0) {
    cartBadgeEl.textContent = String(totalQty);
    cartBadgeEl.style.display = "flex";
    cartFab.classList.add("visible", "cart-fab--has-items");
    if (cartFabLabel) {
      cartFabLabel.textContent = "Shiko porosin";
      cartFabLabel.style.display = "block";
    }
  } else {
    cartBadgeEl.style.display = "none";
    cartFab.classList.remove("visible", "cart-fab--has-items");
    if (cartFabLabel) {
      cartFabLabel.style.display = "none";
    }
  }
}

function renderMiniCart() {
  if (!detailCartSection) return;

  if (!cart.length) {
    detailCartSection.style.display = "none";
    return;
  }

  detailCartSection.style.display = "block";
  detailCartItemsEl.innerHTML = "";
  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <span>${item.qty}× ${item.name}</span>
      <span>${(item.price * item.qty).toFixed(2)} €</span>
    `;
    detailCartItemsEl.appendChild(row);
  });

  detailCartTotalEl.textContent = `Summe: ${total.toFixed(2)} €`;
  if (detailCartTableLabel) {
    detailCartTableLabel.textContent = `Tavolina ${tableId}`;
  }
}

function changeCart(item, deltaQty) {
  const index = cart.findIndex((c) => c.id === item.id);
  if (index === -1 && deltaQty > 0) {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: deltaQty,
    });
  } else if (index >= 0) {
    cart[index].qty += deltaQty;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
  }
  saveCartToStorage();
  updateCartBadge();
  renderMiniCart();
}

/* =========================
   PRODUKT LADEN
   ========================= */

async function loadItem() {
  // Tisch-Label im Header
  if (detailTableBadge) {
    detailTableBadge.textContent = `Tavolina ${tableId}`;
  }

  if (!itemId) {
    detailNameEl.textContent = "Produkti nuk u gjet";
    detailLongDescEl.textContent = "Mungon ID e produktit në URL.";
    return;
  }

  try {
    // Produkt aus Firestore laden
    const itemRef = doc(db, "restaurants", restaurantId, "menuItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      detailNameEl.textContent = "Produkti nuk u gjet";
      detailLongDescEl.textContent = "Ju lutem njoftoni stafin.";
      return;
    }

    const d = itemSnap.data();
    currentItem = {
      id: itemSnap.id,
      name: d.name || "Produkt",
      description: d.description || "",
      longDescription: d.longDescription || "",
      price: d.price || 0,
      imageUrl: d.imageUrl || null,
      ratingCount: d.ratingCount || 0,
      ratingSum: d.ratingSum || 0,
      likeCount: d.likeCount || 0,
    };

    // Bild
    if (currentItem.imageUrl) {
      detailImageEl.src = currentItem.imageUrl;
      detailImageEl.style.display = "block";
    } else {
      detailImageEl.style.display = "none";
    }

    // Texte
    detailNameEl.textContent = currentItem.name;
    detailPriceEl.textContent = currentItem.price.toFixed(2) + " €";

    const longText =
      currentItem.longDescription || currentItem.description || "";
    detailLongDescEl.textContent = longText || "—";

    detailZutatenEl.textContent =
      currentItem.description || "—";

    // Rating-Anzeige (nur read-only, keine Logik hier)
    const { ratingCount, ratingSum } = currentItem;
    if (ratingCount > 0) {
      const avg = ratingSum / ratingCount;
      detailRatingEl.textContent = `⭐ ${avg.toFixed(1)} · ${ratingCount} vlerësime`;
    } else {
      detailRatingEl.textContent = "Ende pa vlerësime";
    }

    // Start-Menge
    currentQty = 1;
    detailQtyValueEl.textContent = String(currentQty);
  } catch (err) {
    console.error(err);
    detailNameEl.textContent = "Gabim";
    detailLongDescEl.textContent = err.message;
  }
}

/* =========================
   NAVIGATION
   ========================= */

function goToKarte() {
  // Stabil: wenn History vorhanden → back, sonst direkt zur Karte
  if (window.history.length > 1) {
    history.back();
  } else {
    const url = new URL(window.location.href);
    url.pathname = "karte.html";
    url.searchParams.set("r", restaurantId);
    url.searchParams.set("t", tableId);
    window.location.href = url.toString();
  }
}

function goToPorosia() {
  if (!cart.length) return;
  const url = new URL(window.location.href);
  url.pathname = "porosia.html";
  url.searchParams.set("r", restaurantId);
  url.searchParams.set("t", tableId);
  window.location.href = url.toString();
}

/* =========================
   EVENTS
   ========================= */

// Zurück-Button
if (backBtn) {
  backBtn.addEventListener("click", goToKarte);
}

// Menge -
detailQtyMinusBtn.addEventListener("click", () => {
  if (currentQty > 1) {
    currentQty -= 1;
    detailQtyValueEl.textContent = String(currentQty);
  }
});

// Menge +
detailQtyPlusBtn.addEventListener("click", () => {
  currentQty += 1;
  detailQtyValueEl.textContent = String(currentQty);
});

// Shto në porosi
detailAddBtn.addEventListener("click", () => {
  if (!currentItem) return;
  changeCart(currentItem, currentQty);
});

// Shiko porosin Button in der Card
detailViewCartBtn.addEventListener("click", () => {
  goToPorosia();
});

// FAB → Porosia
cartFab.addEventListener("click", () => {
  goToPorosia();
});

// Optional: Like-Button vorerst nur UI (keine Logik, damit alles leicht bleibt)
if (detailLikeBtn) {
  detailLikeBtn.addEventListener("click", () => {
    // Später können wir hier Firestore-Likes ergänzen
  });
}

// Safari BFCache: beim Zurückkommen von Porosia / Karte → Cart & Badge neu laden
window.addEventListener("pageshow", () => {
  cart = loadCartFromStorage();
  updateCartBadge();
  renderMiniCart();
});

/* =========================
   INIT
   ========================= */

cart = loadCartFromStorage();
updateCartBadge();
renderMiniCart();
loadItem();


