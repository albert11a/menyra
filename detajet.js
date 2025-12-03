// detajet.js – Detailansicht für ein Produkt, nutzt globalen Cart + Porosia-Seite

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";
const itemId = params.get("item");

// DOM
const backBtn = document.getElementById("backBtn");
const detailTableBadge = document.getElementById("detailTableBadge");

const detailImageEl = document.getElementById("detailImage");
const detailNameEl = document.getElementById("detailName");
const detailPriceEl = document.getElementById("detailPrice");
const detailLongDescEl = document.getElementById("detailLongDesc");
const detailZutatenEl = document.getElementById("detailZutaten");

const detailQtyMinusBtn = document.getElementById("detailQtyMinus");
const detailQtyPlusBtn = document.getElementById("detailQtyPlus");
const detailQtyValueEl = document.getElementById("detailQtyValue");
const detailAddBtn = document.getElementById("detailAddBtn");
const detailViewCartBtn = document.getElementById("detailViewCartBtn");

// Mini-Cart in Detajet
const detailCartSection = document.getElementById("detailCartSection");
const detailCartItemsEl = document.getElementById("detailCartItems");
const detailCartTotalEl = document.getElementById("detailCartTotal");
const detailCartTableLabel = document.getElementById("detailCartTableLabel");

// FAB wie auf Karte
const cartFab = document.getElementById("cartFab");
const cartFabLabel = document.getElementById("cartFabLabel");
const cartBadgeEl = document.getElementById("cartBadge");

let cart = [];
let currentItem = null;
let currentQty = 1;

/* =========================
   CART: LOCALSTORAGE
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
  } catch {}
}

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
    if (cartFabLabel) cartFabLabel.style.display = "none";
  }
}

function renderMiniCart() {
  if (!cart.length) {
    detailCartSection.style.display = "none";
    updateCartBadge();
    saveCartToStorage();
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
  detailCartTableLabel.textContent = `Tisch ${tableId}`;
  updateCartBadge();
  saveCartToStorage();
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
  renderMiniCart();
}

/* =========================
   LOAD ITEM
   ========================= */

async function loadItem() {
  if (!itemId) {
    detailNameEl.textContent = "Produkt nicht gefunden";
    detailLongDescEl.textContent = "Keine ID in der URL.";
    return;
  }

  if (detailTableBadge) {
    detailTableBadge.textContent = `Tisch ${tableId}`;
  }

  try {
    const itemRef = doc(db, "restaurants", restaurantId, "menuItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      detailNameEl.textContent = "Produkt nicht gefunden";
      detailLongDescEl.textContent = "Bitte Personal informieren.";
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
    };

    if (currentItem.imageUrl) {
      detailImageEl.src = currentItem.imageUrl;
      detailImageEl.style.display = "block";
    } else {
      detailImageEl.style.display = "none";
    }

    detailNameEl.textContent = currentItem.name;
    detailPriceEl.textContent = currentItem.price.toFixed(2) + " €";

    const longText =
      currentItem.longDescription || currentItem.description || "";
    detailLongDescEl.textContent = longText;

    detailZutatenEl.textContent = currentItem.description || "";

    currentQty = 1;
    detailQtyValueEl.textContent = String(currentQty);
  } catch (err) {
    console.error(err);
    detailNameEl.textContent = "Fehler";
    detailLongDescEl.textContent = err.message;
  }
}

/* =========================
   EVENTS
   ========================= */

if (backBtn) {
  backBtn.addEventListener("click", () => {
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
}

detailQtyMinusBtn.addEventListener("click", () => {
  if (currentQty > 1) {
    currentQty -= 1;
    detailQtyValueEl.textContent = String(currentQty);
  }
});

detailQtyPlusBtn.addEventListener("click", () => {
  currentQty += 1;
  detailQtyValueEl.textContent = String(currentQty);
});

detailAddBtn.addEventListener("click", () => {
  if (!currentItem) return;
  changeCart(currentItem, currentQty);
});

// Shiko porosin Button
detailViewCartBtn.addEventListener("click", () => {
  if (!cart.length) return;
  const url = new URL(window.location.href);
  url.pathname = "porosia.html";
  url.searchParams.set("r", restaurantId);
  url.searchParams.set("t", tableId);
  window.location.href = url.toString();
});

// FAB → Porosia
cartFab.addEventListener("click", () => {
  if (!cart.length) return;
  const url = new URL(window.location.href);
  url.pathname = "porosia.html";
  url.searchParams.set("r", restaurantId);
  url.searchParams.set("t", tableId);
  window.location.href = url.toString();
});

// Safari BFCache: beim Zurückkommen Cart neu laden
window.addEventListener("pageshow", () => {
  cart = loadCartFromStorage();
  renderMiniCart();
});

/* =========================
   INIT
   ========================= */

cart = loadCartFromStorage();
renderMiniCart();
loadItem();
