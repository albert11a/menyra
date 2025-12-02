// admin.js – Restaurant Admin: Login, Speisekarte (inkl. Angebote), Bestellübersicht

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  getDoc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const adminRestLabel = document.getElementById("adminRestLabel");
const adminLoginCard = document.getElementById("adminLoginCard");
const adminCodeInput = document.getElementById("adminCodeInput");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginStatus = document.getElementById("adminLoginStatus");

const menuEditorCard = document.getElementById("menuEditorCard");
const menuListCard = document.getElementById("menuListCard");
const ordersCard = document.getElementById("ordersCard");

const itemCatInput = document.getElementById("itemCatInput");
const itemNameInput = document.getElementById("itemNameInput");
const itemDescInput = document.getElementById("itemDescInput");
const itemPriceInput = document.getElementById("itemPriceInput");
const itemImageInput = document.getElementById("itemImageInput");
const itemOfferInput = document.getElementById("itemOfferInput");
const addItemBtn = document.getElementById("addItemBtn");
const adminItemStatus = document.getElementById("adminItemStatus");
const itemList = document.getElementById("itemList");
const adminOrdersList = document.getElementById("adminOrdersList");

let currentRestaurantId = null;

function saveOwnerSession(restaurantId) {
  localStorage.setItem("menyra_owner_restaurantId", restaurantId);
}

function loadOwnerSession() {
  return localStorage.getItem("menyra_owner_restaurantId");
}

async function setRestaurantById(id) {
  adminLoginStatus.textContent = "";
  adminLoginStatus.className = "status-text";

  const refRest = doc(db, "restaurants", id);
  const snap = await getDoc(refRest);
  if (!snap.exists()) {
    adminLoginStatus.textContent = "Lokal mit dieser ID existiert nicht.";
    adminLoginStatus.classList.add("status-err");
    return false;
  }
  const data = snap.data();
  currentRestaurantId = id;
  saveOwnerSession(currentRestaurantId);

  adminRestLabel.textContent = data.restaurantName || currentRestaurantId;
  adminLoginCard.style.display = "none";
  menuEditorCard.style.display = "block";
  menuListCard.style.display = "block";
  ordersCard.style.display = "block";

  await loadMenuItems();
  await loadTodayOrders();
  return true;
}

async function loginWithCode(code) {
  adminLoginStatus.textContent = "";
  adminLoginStatus.className = "status-text";

  if (!code) {
    adminLoginStatus.textContent = "Bitte Admin-Code eingeben.";
    adminLoginStatus.classList.add("status-err");
    return;
  }

  try {
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = "Prüfe...";

    const qRest = query(
      collection(db, "restaurants"),
      where("ownerCode", "==", code)
    );
    const snap = await getDocs(qRest);

    if (snap.empty) {
      adminLoginStatus.textContent = "Kein Lokal mit diesem Admin-Code gefunden.";
      adminLoginStatus.classList.add("status-err");
      return;
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();
    currentRestaurantId = docSnap.id;

    saveOwnerSession(currentRestaurantId);

    adminRestLabel.textContent = data.restaurantName || currentRestaurantId;
    adminLoginCard.style.display = "none";
    menuEditorCard.style.display = "block";
    menuListCard.style.display = "block";
    ordersCard.style.display = "block";

    await loadMenuItems();
    await loadTodayOrders();
  } catch (err) {
    console.error(err);
    adminLoginStatus.textContent = "Fehler: " + err.message;
    adminLoginStatus.classList.add("status-err");
  } finally {
    adminLoginBtn.disabled = false;
    adminLoginBtn.textContent = "Einloggen";
  }
}

async function addMenuItem() {
  adminItemStatus.textContent = "";
  adminItemStatus.className = "status-text";

  const cat = itemCatInput.value.trim() || "Sonstiges";
  const name = itemNameInput.value.trim();
  const desc = itemDescInput.value.trim();
  const priceStr = itemPriceInput.value.trim();
  const imageUrl = itemImageInput.value.trim();
  const isOffer = itemOfferInput.checked;

  if (!cat || !name || !priceStr) {
    adminItemStatus.textContent = "Kategorie, Name und Preis sind Pflicht.";
    adminItemStatus.classList.add("status-err");
    return;
  }

  const price = parseFloat(priceStr.replace(",", "."));
  if (isNaN(price)) {
    adminItemStatus.textContent = "Preis ist keine Zahl.";
    adminItemStatus.classList.add("status-err");
    return;
  }

  try {
    addItemBtn.disabled = true;
    addItemBtn.textContent = "Speichere...";

    const menuCol = collection(doc(db, "restaurants", currentRestaurantId), "menuItems");
    await addDoc(menuCol, {
      category: cat,
      name,
      description: desc,
      price,
      imageUrl: imageUrl || null,
      offer: isOffer,
      available: true,
    });

    adminItemStatus.textContent = "Gericht gespeichert.";
    adminItemStatus.classList.add("status-ok");

    itemCatInput.value = "";
    itemNameInput.value = "";
    itemDescInput.value = "";
    itemPriceInput.value = "";
    itemImageInput.value = "";
    itemOfferInput.checked = false;

    await loadMenuItems();
  } catch (err) {
    console.error(err);
    adminItemStatus.textContent = "Fehler: " + err.message;
    adminItemStatus.classList.add("status-err");
  } finally {
    addItemBtn.disabled = false;
    addItemBtn.textContent = "Gericht speichern";
  }
}

async function loadMenuItems() {
  itemList.innerHTML = "<div class='info'>Lade...</div>";

  const menuCol = collection(doc(db, "restaurants", currentRestaurantId), "menuItems");
  const snap = await getDocs(menuCol);

  itemList.innerHTML = "";
  if (snap.empty) {
    itemList.innerHTML = "<div class='info'>Noch keine Gerichte.</div>";
    return;
  }

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const available = data.available !== false;
    const hasImage = !!data.imageUrl;
    const isOffer = data.offer === true;

    const row = document.createElement("div");
    row.className = "list-item-row";
    row.innerHTML = `
      <span>
        [${data.category || "Sonstiges"}] ${data.name} – ${data.price.toFixed(2)} €
        <br/>
        <span class="info">
          ${data.description || ""}${
      hasImage ? " • Foto: vorhanden" : " • Foto: keines"
    }${isOffer ? " • ⭐ Angebot" : ""} • Status: ${
      available ? "aktiv" : "inaktiv"
    }
        </span>
      </span>
      <span style="display:flex; gap:6px;">
        <button class="btn btn-ghost btn-small" data-id="${docSnap.id}" data-action="toggle">
          ${available ? "Deaktivieren" : "Aktivieren"}
        </button>
        <button class="btn btn-ghost btn-small" data-id="${docSnap.id}" data-action="delete">
          Löschen
        </button>
      </span>
    `;
    itemList.appendChild(row);
  });

  itemList.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const menuCol = collection(doc(db, "restaurants", currentRestaurantId), "menuItems");

      if (action === "delete") {
        if (!confirm("Dieses Gericht wirklich löschen?")) return;
        await deleteDoc(doc(menuCol, id));
        await loadMenuItems();
      } else if (action === "toggle") {
        const currentlyActive = btn.textContent.includes("Deaktivieren");
        const newAvailable = !currentlyActive;

        await updateDoc(doc(menuCol, id), { available: newAvailable });
        await loadMenuItems();
      }
    },
    { once: true }
  );
}

function mapStatusLabel(status) {
  if (status === "new") return "Neu";
  if (status === "in_progress") return "In Arbeit";
  if (status === "served") return "Serviert";
  return status || "";
}

async function loadTodayOrders() {
  adminOrdersList.innerHTML = "<div class='info'>Lade...</div>";

  const ordersCol = collection(doc(db, "restaurants", currentRestaurantId), "orders");
  const snap = await getDocs(ordersCol);

  const todayISO = new Date().toISOString().slice(0, 10);
  const orders = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const created = data.createdAt?.toDate?.();
    const dateStr = created ? created.toISOString().slice(0, 10) : null;

    if (dateStr === todayISO) {
      const total =
        (data.items || []).reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0) ||
        0;
      orders.push({
        id: docSnap.id,
        table: data.table || "?",
        status: data.status || "new",
        time: created
          ? created.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })
          : "",
        total,
        count: (data.items || []).reduce((sum, item) => sum + (item.qty || 0), 0),
      });
    }
  });

  orders.sort((a, b) => (a.time < b.time ? 1 : -1));

  adminOrdersList.innerHTML = "";
  if (!orders.length) {
    adminOrdersList.innerHTML = "<div class='info'>Heute noch keine Bestellungen.</div>";
    return;
  }

  orders.forEach((o) => {
    const div = document.createElement("div");
    div.className = "list-item-row";
    div.innerHTML = `
      <span>
        ${o.time} – Tisch ${o.table}
        <br/>
        <span class="info">
          ${o.count} Positionen • ${o.total.toFixed(2)} € • Status: ${mapStatusLabel(o.status)}
        </span>
      </span>
    `;
    adminOrdersList.appendChild(div);
  });
}

adminLoginBtn.addEventListener("click", () => {
  loginWithCode(adminCodeInput.value.trim());
});

addItemBtn.addEventListener("click", addMenuItem);

// Direktzugang: admin.html?r=restaurantId
const params = new URLSearchParams(window.location.search);
const directRestId = params.get("r");

if (directRestId) {
  setRestaurantById(directRestId);
} else {
  const storedRestId = loadOwnerSession();
  if (storedRestId) {
    setRestaurantById(storedRestId);
  }
}
