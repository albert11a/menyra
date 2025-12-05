// porosia.js – Finale Bestellübersicht + Bestellung senden

import { db } from "./firebase-config.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";

// DOM
const restaurantNameEl = document.getElementById("porosiaRestaurantName");
const tableLabelEl = document.getElementById("porosiaTableLabel");

const itemsEl = document.getElementById("porosiaItems");
const totalEl = document.getElementById("porosiaTotal");
const noteEl = document.getElementById("porosiaNote");
const clearBtn = document.getElementById("porosiaClearBtn");
const sendBtn = document.getElementById("porosiaSendBtn");
const statusEl = document.getElementById("porosiaStatus");
const backBtn = document.getElementById("porosiaBackBtn");

// FAB
const cartFab = document.getElementById("cartFab");
const cartFabLabel = document.getElementById("cartFabLabel");
const cartBadgeEl = document.getElementById("cartBadge");

let cart = [];

/* =========================
   CART STORAGE
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

/* =========================
   CART UI
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
    if (cartFabLabel) cartFabLabel.style.display = "none";
  }
}

function renderCart() {
  itemsEl.innerHTML = "";
  let total = 0;

  if (!cart.length) {
    itemsEl.innerHTML = "<p class='info'>Nuk ke asnjë artikull në porosi.</p>";
    totalEl.textContent = "";
    updateCartBadge();
    saveCartToStorage();
    return;
  }

  cart.forEach((item, idx) => {
    total += item.price * item.qty;

    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.style.alignItems = "center";
    row.style.gap = "8px";

    const leftSpan = document.createElement("span");
    leftSpan.textContent = `${item.qty}× ${item.name}`;

    const rightWrap = document.createElement("div");
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.gap = "6px";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "btn btn-ghost btn-small";
    minusBtn.textContent = "−";
    minusBtn.addEventListener("click", () => changeCartQty(idx, -1));

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "btn btn-primary btn-small";
    plusBtn.textContent = "+";
    plusBtn.addEventListener("click", () => changeCartQty(idx, +1));

    const priceSpan = document.createElement("span");
    priceSpan.textContent = (item.price * item.qty).toFixed(2) + " €";

    rightWrap.appendChild(minusBtn);
    rightWrap.appendChild(plusBtn);
    rightWrap.appendChild(priceSpan);

    row.appendChild(leftSpan);
    row.appendChild(rightWrap);

    itemsEl.appendChild(row);
  });

  totalEl.textContent = `Summe: ${total.toFixed(2)} €`;
  updateCartBadge();
  saveCartToStorage();
}

function changeCartQty(index, delta) {
  if (index < 0 || index >= cart.length) return;
  cart[index].qty += delta;
  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }
  renderCart();
}

/* =========================
   FIRESTORE: RESTAURANT INFO
   ========================= */

async function loadRestaurantHeader() {
  try {
    const restRef = doc(db, "restaurants", restaurantId);
    const snap = await getDoc(restRef);
    if (snap.exists()) {
      const data = snap.data();
      restaurantNameEl.textContent = data.restaurantName || "Lokal";
    } else {
      restaurantNameEl.textContent = "Lokal";
    }
  } catch (err) {
    console.error(err);
  }

  tableLabelEl.textContent = `Tisch ${tableId}`;
}

/* =========================
   SEND ORDER
   ========================= */

async function sendOrder() {
  statusEl.textContent = "";
  statusEl.className = "status-text";

  if (!cart.length) {
    statusEl.textContent = "Nuk ke asgjë në porosi.";
    statusEl.classList.add("status-err");
    return;
  }

  try {
    sendBtn.disabled = true;
    sendBtn.textContent = "Duke dërguar...";

    const restRef = doc(db, "restaurants", restaurantId);
    const ordersCol = collection(restRef, "orders");

    const total = cart.reduce(
      (sum, c) => sum + (c.price || 0) * (c.qty || 0),
      0
    );

    const payload = {
      restaurantId,
      table: tableId,
      items: cart.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        qty: c.qty,
      })),
      note: noteEl.value || "",
      status: "new",
      paid: false,          // wichtig für "Për t'u paguar"
      total,                // Gesamtbetrag speichern
      createdAt: serverTimestamp(),
      source: "qr",
    };

    await addDoc(ordersCol, payload);

    // Cart leeren + speichern
    cart = [];
    renderCart();
    noteEl.value = "";

    statusEl.textContent = "Porosia u dërgua. Faleminderit!";
    statusEl.classList.add("status-ok");

    // Zurück zur Karte – dort erscheint dann "Porosia juaj"
    const url = new URL(window.location.href);
    url.pathname = "karte.html";
    url.searchParams.set("r", restaurantId);
    url.searchParams.set("t", tableId);
    window.location.href = url.toString();
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Gabim gjatë dërgimit: " + err.message;
    statusEl.classList.add("status-err");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Dërgo porosinë";
  }
}

/* =========================
   EVENTS
   ========================= */

clearBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});

sendBtn.addEventListener("click", sendOrder);

if (backBtn) {
  backBtn.addEventListener("click", () => {
    const url = new URL(window.location.href);
    url.pathname = "karte.html";
    url.searchParams.set("r", restaurantId);
    url.searchParams.set("t", tableId);
    window.location.href = url.toString();
  });
}

// FAB – zurück zur Karte
cartFab.addEventListener("click", () => {
  const url = new URL(window.location.href);
  url.pathname = "karte.html";
  url.searchParams.set("r", restaurantId);
  url.searchParams.set("t", tableId);
  window.location.href = url.toString();
});

/* =========================
   INIT
   ========================= */

cart = loadCartFromStorage();
renderCart();
loadRestaurantHeader();

// Safari BFCache – beim Zurückspringen Porosia-Seite aktualisieren
window.addEventListener("pageshow", () => {
  cart = loadCartFromStorage();
  renderCart();
});
