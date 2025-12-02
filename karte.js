// karte.js – Gäste-Ansicht mit Logo & Produktbildern (lazy load)

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";

document.getElementById("tableLabel").textContent = `Tisch: ${tableId}`;

const restaurantLogoEl = document.getElementById("restaurantLogo");
const restaurantNameEl = document.getElementById("restaurantName");
const restaurantMetaEl = document.getElementById("restaurantMeta");
const categoryTabsEl = document.getElementById("categoryTabs");
const menuListEl = document.getElementById("menuList");
const cartSection = document.getElementById("cartSection");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const noteInput = document.getElementById("noteInput");
const statusMsg = document.getElementById("statusMsg");

let allMenuItems = [];
let activeCategory = "Alle";
let cart = [];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSubscriptionValid(data) {
  if (!data.subscriptionUntil) return true;
  const today = todayISO();
  return data.subscriptionUntil >= today;
}

function isRestaurantOperational(data) {
  if (data.active === false) return false;
  if (!isSubscriptionValid(data)) return false;
  return true;
}

async function loadRestaurantAndMenu() {
  try {
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      restaurantNameEl.textContent = "Lokal nicht gefunden";
      restaurantMetaEl.textContent = `ID: ${restaurantId}`;
      menuListEl.innerHTML = "<p class='info'>Bitte Personal informieren.</p>";
      cartSection.style.display = "none";
      return;
    }

    const data = restaurantSnap.data();
    restaurantNameEl.textContent = data.restaurantName || "Unbenanntes Lokal";
    restaurantMetaEl.textContent = `${data.city || ""} · ID: ${restaurantId}`;

    if (data.logoUrl) {
      restaurantLogoEl.src = data.logoUrl;
      restaurantLogoEl.style.display = "block";
    } else {
      restaurantLogoEl.style.display = "none";
    }

    if (!isRestaurantOperational(data)) {
      menuListEl.innerHTML =
        "<p class='info'>Dieses MENYRA ist aktuell nicht aktiv. Bitte Personal informieren.</p>";
      cartSection.style.display = "none";
      return;
    }

    const menuCol = collection(restaurantRef, "menuItems");
    const snap = await getDocs(menuCol);

    allMenuItems = snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || "Produkt",
          description: d.description || "",
          price: d.price || 0,
          category: d.category || "Sonstiges",
          available: d.available !== false,
          imageUrl: d.imageUrl || null,
        };
      })
      .filter((item) => item.available);

    renderCategories();
    renderMenu();
  } catch (err) {
    console.error(err);
    restaurantNameEl.textContent = "Fehler";
    restaurantMetaEl.textContent = err.message;
    menuListEl.innerHTML = "<p class='info'>Fehler beim Laden der Speisekarte.</p>";
    cartSection.style.display = "none";
  }
}

function getCategories() {
  const set = new Set();
  allMenuItems.forEach((i) => set.add(i.category));
  return Array.from(set);
}

function renderCategories() {
  categoryTabsEl.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className =
    "category-tab" + (activeCategory === "Alle" ? " active" : "");
  allBtn.textContent = "Alle";
  allBtn.addEventListener("click", () => {
    activeCategory = "Alle";
    renderCategories();
    renderMenu();
  });
  categoryTabsEl.appendChild(allBtn);

  getCategories().forEach((cat) => {
    const btn = document.createElement("button");
    btn.className =
      "category-tab" + (activeCategory === cat ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderCategories();
      renderMenu();
    });
    categoryTabsEl.appendChild(btn);
  });
}

function renderMenu() {
  menuListEl.innerHTML = "";

  const items =
    activeCategory === "Alle"
      ? allMenuItems
      : allMenuItems.filter((i) => i.category === activeCategory);

  if (!items.length) {
    menuListEl.innerHTML = "<p class='info'>Keine Produkte.</p>";
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "menu-item";

    // Wir bauen das DOM per JS, damit wir loading="lazy" setzen können
    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.className = "menu-item-image";
      img.loading = "lazy"; // wichtig für langsamere Verbindungen
      div.appendChild(img);
    }

    const header = document.createElement("div");
    header.className = "menu-item-header";

    const nameEl = document.createElement("div");
    nameEl.className = "menu-item-name";
    nameEl.textContent = item.name;

    const priceEl = document.createElement("div");
    priceEl.className = "menu-item-price";
    priceEl.textContent = item.price.toFixed(2) + " €";

    header.appendChild(nameEl);
    header.appendChild(priceEl);
    div.appendChild(header);

    const descEl = document.createElement("div");
    descEl.className = "menu-item-desc";
    descEl.textContent = item.description;
    div.appendChild(descEl);

    const actions = document.createElement("div");
    actions.className = "menu-item-actions";

    const minusBtn = document.createElement("button");
    minusBtn.className = "btn btn-ghost";
    minusBtn.textContent = "−";
    minusBtn.addEventListener("click", () => changeCart(item, -1));

    const plusBtn = document.createElement("button");
    plusBtn.className = "btn btn-primary";
    plusBtn.textContent = "Hinzufügen";
    plusBtn.addEventListener("click", () => changeCart(item, 1));

    actions.appendChild(minusBtn);
    actions.appendChild(plusBtn);
    div.appendChild(actions);

    menuListEl.appendChild(div);
  });
}

function changeCart(item, delta) {
  const index = cart.findIndex((c) => c.id === item.id);
  if (index === -1 && delta > 0) {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
  } else if (index >= 0) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
  }
  renderCart();
}

function renderCart() {
  if (!cart.length) {
    cartSection.style.display = "none";
    return;
  }

  cartSection.style.display = "block";
  cartItemsEl.innerHTML = "";
  let total = 0;

  cart.forEach((item) => {
    total += item.price * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <span>${item.qty}× ${item.name}</span>
      <span>${(item.price * item.qty).toFixed(2)} €</span>
    `;
    cartItemsEl.appendChild(row);
  });

  cartTotalEl.textContent = `Summe: ${total.toFixed(2)} €`;
}

async function sendOrder() {
  statusMsg.textContent = "";
  statusMsg.className = "status-text";

  if (!cart.length) {
    statusMsg.textContent = "Bitte zuerst Produkte auswählen.";
    statusMsg.classList.add("status-err");
    return;
  }

  try {
    sendOrderBtn.disabled = true;
    sendOrderBtn.textContent = "Sende...";

    const restaurantRef = doc(db, "restaurants", restaurantId);
    const ordersCol = collection(restaurantRef, "orders");

    await addDoc(ordersCol, {
      table: tableId,
      items: cart.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        qty: c.qty,
      })),
      note: noteInput.value || "",
      status: "new",
      createdAt: serverTimestamp(),
      source: "qr",
    });

    cart = [];
    renderCart();
    noteInput.value = "";
    statusMsg.textContent = "Bestellung gesendet. Danke!";
    statusMsg.classList.add("status-ok");
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "Fehler: " + err.message;
    statusMsg.classList.add("status-err");
  } finally {
    sendOrderBtn.disabled = false;
    sendOrderBtn.textContent = "Bestellung senden";
  }
}

clearCartBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});

sendOrderBtn.addEventListener("click", sendOrder);

loadRestaurantAndMenu();
