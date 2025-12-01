import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const adminRestLabel = document.getElementById("adminRestLabel");
const adminLoginCard = document.getElementById("adminLoginCard");
const adminCodeInput = document.getElementById("adminCodeInput");
const adminLoginBtn = document.getElementById("adminLoginBtn");
const adminLoginStatus = document.getElementById("adminLoginStatus");

const menuEditorCard = document.getElementById("menuEditorCard");
const menuListCard = document.getElementById("menuListCard");
const itemNameInput = document.getElementById("itemNameInput");
const itemDescInput = document.getElementById("itemDescInput");
const itemPriceInput = document.getElementById("itemPriceInput");
const itemCatInput = document.getElementById("itemCatInput");
const addItemBtn = document.getElementById("addItemBtn");
const adminItemStatus = document.getElementById("adminItemStatus");
const itemList = document.getElementById("itemList");

let currentRestaurantId = null;

function saveOwnerSession(restaurantId) {
  localStorage.setItem("menyra_owner_restaurantId", restaurantId);
}

function loadOwnerSession() {
  return localStorage.getItem("menyra_owner_restaurantId");
}

async function loginWithCode(code) {
  adminLoginStatus.textContent = "";
  adminLoginStatus.className = "status-text";

  if (!code) {
    adminLoginStatus.textContent = "Bitte Code eingeben.";
    adminLoginStatus.classList.add("status-err");
    return;
  }

  try {
    adminLoginBtn.disabled = true;
    adminLoginBtn.textContent = "Prüfe...";

    const q = query(
      collection(db, "restaurants"),
      where("ownerCode", "==", code)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      adminLoginStatus.textContent = "Kein Lokal mit diesem Admin-Code gefunden.";
      adminLoginStatus.classList.add("status-err");
      return;
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();
    currentRestaurantId = docSnap.id;

    saveOwnerSession(currentRestaurantId);

    adminRestLabel.textContent = data.name || currentRestaurantId;
    adminLoginCard.style.display = "none";
    menuEditorCard.style.display = "block";
    menuListCard.style.display = "block";

    await loadMenuItems();
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

  const name = itemNameInput.value.trim();
  const desc = itemDescInput.value.trim();
  const priceStr = itemPriceInput.value.trim();
  const cat = itemCatInput.value.trim() || "Sonstiges";

  if (!name || !priceStr) {
    adminItemStatus.textContent = "Name und Preis sind Pflicht.";
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
    await addDoc(menuCol, { name, description: desc, price, category: cat });

    adminItemStatus.textContent = "Gericht gespeichert.";
    adminItemStatus.classList.add("status-ok");

    itemNameInput.value = "";
    itemDescInput.value = "";
    itemPriceInput.value = "";
    itemCatInput.value = "";

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
    const row = document.createElement("div");
    row.className = "list-item-row";
    row.innerHTML = `
      <span>
        ${data.name} – ${data.price.toFixed(2)} €
        <br/>
        <span class="info">${data.category || ""}</span>
      </span>
      <button class="btn btn-ghost btn-small" data-id="${docSnap.id}">Löschen</button>
    `;
    itemList.appendChild(row);
  });

  itemList.addEventListener(
    "click",
    async (e) => {
      const btn = e.target.closest("button[data-id]");
      if (!btn) return;
      const id = btn.dataset.id;
      if (!confirm("Dieses Gericht wirklich löschen?")) return;
      const menuCol = collection(doc(db, "restaurants", currentRestaurantId), "menuItems");
      await deleteDoc(doc(menuCol, id));
      await loadMenuItems();
    },
    { once: true }
  );
}

adminLoginBtn.addEventListener("click", () => {
  loginWithCode(adminCodeInput.value.trim());
});

addItemBtn.addEventListener("click", addMenuItem);

// Auto-Login, falls Admin schon einmal eingeloggt war
const storedRestId = loadOwnerSession();
if (storedRestId) {
  currentRestaurantId = storedRestId;
  adminRestLabel.textContent = storedRestId;
  adminLoginCard.style.display = "none";
  menuEditorCard.style.display = "block";
  menuListCard.style.display = "block";
  loadMenuItems();
}
