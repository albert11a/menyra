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
const detailImageEl = document.getElementById("detailImage");
const detailTitleEl = document.getElementById("detailTitle");
const detailPriceEl = document.getElementById("detailPrice");
const detailLongDescEl = document.getElementById("detailLongDesc");
const detailZutatenEl = document.getElementById("detailZutaten");

const detailQtyMinusBtn = document.getElementById("detailQtyMinus");
const detailQtyPlusBtn = document.getElementById("detailQtyPlus");
const detailQtyValueEl = document.getElementById("detailQtyValue");
const detailAddBtn = document.getElementById("detailAddBtn");

const headerRestaurantName = document.getElementById("detailRestaurantName");
const headerTableLabel = document.getElementById("detailTableLabel");
const backBtn = document.getElementById("detailBackBtn");

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
}

/* =========================
   LOAD ITEM
   ========================= */

async function loadItem() {
  if (!itemId) {
    detailTitleEl.textContent = "Produkt nicht gefunden";
    detailLongDescEl.textContent = "Keine ID in der URL.";
    return;
  }

  if (headerTableLabel) {
    headerTableLabel.textContent = `Tisch ${tableId}`;
  }

  try {
    const restRef = doc(db, "restaurants", restaurantId);
    const restSnap = await getDoc(restRef);
    if (restSnap.exists() && headerRestaurantName) {
      const data = restSnap.data();
      headerRestaurantName.textContent = data.restaurantName || "Lokal";
    }

    const itemRef = doc(db, "restaurants", restaurantId, "menuItems", itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      detailTitleEl.textContent = "Produkt nicht gefunden";
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

    detailTitleEl.textContent = currentItem.name;
    detailPriceEl.textContent = currentItem.price.toFixed(2) + " €";

    const longText =
      currentItem.longDescription || currentItem.description || "";
    detailLongDescEl.textContent = longText;

    detailZutatenEl.textContent = currentItem.description || "";

    currentQty = 1;
    detailQtyValueEl.textContent = String(currentQty);
  } catch (err) {
    console.error(err);
    detailTitleEl.textContent = "Fehler";
    detailLongDescEl.textContent = err.message;
  }
}

/* =========================
   EVENTS
   ========================= */

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

// FAB → Porosia
cartFab.addEventListener("click", () => {
  if (!cart.length) return;
  const url = new URL(window.location.href);
  url.pathname = "porosia.html";
  url.searchParams.set("r", restaurantId);
  url.searchParams.set("t", tableId);
  window.location.href = url.toString();
});

// Zurück zur Karte – stabil für Browser-Back + Direktaufruf
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

// Safari BFCache: beim Zurückkommen Cart neu laden
window.addEventListener("pageshow", () => {
  cart = loadCartFromStorage();
  updateCartBadge();
});

/* =========================
   INIT
   ========================= */

cart = loadCartFromStorage();
updateCartBadge();
loadItem();
