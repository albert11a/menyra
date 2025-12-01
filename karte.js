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

async function loadRestaurantAndMenu() {
  try {
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      restaurantNameEl.textContent = "Lokal nicht gefunden";
      restaurantMetaEl.textContent = `ID: ${restaurantId}`;
      return;
    }

    const data = restaurantSnap.data();
    restaurantNameEl.textContent = data.name || "Unbenanntes Lokal";
    restaurantMetaEl.textContent = `${data.city || ""} · ID: ${restaurantId}`;

    const menuCol = collection(restaurantRef, "menuItems");
    const snap = await getDocs(menuCol);

    allMenuItems = snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        name: d.name || "Produkt",
        description: d.description || "",
        price: d.price || 0,
        category: d.category || "Sonstiges",
      };
    });

    renderCategories();
    renderMenu();
  } catch (err) {
    console.error(err);
    restaurantNameEl.textContent = "Fehler";
    restaurantMetaEl.textContent = err.message;
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
    div.innerHTML = `
      <div class="menu-item-header">
        <div class="menu-item-name">${item.name}</div>
        <div class="menu-item-price">${item.price.toFixed(2)} €</div>
      </div>
      <div class="menu-item-desc">${item.description}</div>
      <div class="menu-item-actions">
        <button class="btn btn-ghost" data-id="${item.id}" data-action="minus">−</button>
        <button class="btn btn-primary" data-id="${item.id}" data-action="plus">Hinzufügen</button>
      </div>
    `;
    const minusBtn = div.querySelector('[data-action="minus"]');
    const plusBtn = div.querySelector('[data-action="plus"]');
    minusBtn.addEventListener("click", () => changeCart(item, -1));
    plusBtn.addEventListener("click", () => changeCart(item, 1));
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
    statusMsg.textContent = "Bitte zuerst Produkte hinzufügen.";
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
