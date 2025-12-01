import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const kRestLabel = document.getElementById("kRestLabel");
const waiterLoginCard = document.getElementById("waiterLoginCard");
const waiterCodeInput = document.getElementById("waiterCodeInput");
const waiterLoginBtn = document.getElementById("waiterLoginBtn");
const waiterLoginStatus = document.getElementById("waiterLoginStatus");
const orderCard = document.getElementById("orderCard");
const orderList = document.getElementById("orderList");

let currentRestaurantId = null;
let unsubOrders = null;

function saveWaiterSession(restaurantId) {
  localStorage.setItem("menyra_waiter_restaurantId", restaurantId);
}

function loadWaiterSession() {
  return localStorage.getItem("menyra_waiter_restaurantId");
}

async function loginWaiter(code) {
  waiterLoginStatus.textContent = "";
  waiterLoginStatus.className = "status-text";

  if (!code) {
    waiterLoginStatus.textContent = "Bitte Code eingeben.";
    waiterLoginStatus.classList.add("status-err");
    return;
  }

  try {
    waiterLoginBtn.disabled = true;
    waiterLoginBtn.textContent = "Prüfe...";

    const q = query(
      collection(db, "restaurants"),
      where("waiterCode", "==", code)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      waiterLoginStatus.textContent = "Kein Lokal mit diesem Kellner-Code gefunden.";
      waiterLoginStatus.classList.add("status-err");
      return;
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();
    currentRestaurantId = docSnap.id;
    saveWaiterSession(currentRestaurantId);

    kRestLabel.textContent = data.name || currentRestaurantId;
    waiterLoginCard.style.display = "none";
    orderCard.style.display = "block";

    startOrderListener();
  } catch (err) {
    console.error(err);
    waiterLoginStatus.textContent = "Fehler: " + err.message;
    waiterLoginStatus.classList.add("status-err");
  } finally {
    waiterLoginBtn.disabled = false;
    waiterLoginBtn.textContent = "Einloggen";
  }
}

function renderOrders(orders) {
  orderList.innerHTML = "";
  if (!orders.length) {
    orderList.innerHTML = "<div class='info'>Noch keine Bestellungen.</div>";
    return;
  }

  orders.forEach((o) => {
    const div = document.createElement("div");
    div.className = "card";
    const itemsText = o.items
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");

    div.innerHTML = `
      <div class="list-item-row">
        <span>Tisch ${o.table}</span>
        <span class="badge">${o.status}</span>
      </div>
      <div class="info">${itemsText}</div>
      <div class="info">${o.createdAtText || ""}</div>
      <div style="margin-top:8px; display:flex; gap:6px;">
        <button class="btn btn-ghost btn-small" data-id="${o.id}" data-status="in Arbeit">In Arbeit</button>
        <button class="btn btn-primary btn-small" data-id="${o.id}" data-status="serviert">Serviert</button>
      </div>
    `;
    orderList.appendChild(div);
  });
}

function startOrderListener() {
  if (!currentRestaurantId) return;
  if (unsubOrders) unsubOrders();

  const ordersCol = collection(doc(db, "restaurants", currentRestaurantId), "orders");
  unsubOrders = onSnapshot(ordersCol, (snap) => {
    const orders = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const created = data.createdAt?.toDate?.() || null;
      orders.push({
        id: docSnap.id,
        table: data.table || "?",
        items: data.items || [],
        status: data.status || "new",
        createdAtText: created
          ? created.toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })
          : "",
      });
    });

    // neueste oben (nach Zeit sortieren)
    orders.sort((a, b) => (a.createdAtText < b.createdAtText ? 1 : -1));
    renderOrders(orders);
  });

  orderList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    const status = btn.dataset.status;
    const orderRef = doc(db, "restaurants", currentRestaurantId, "orders", id);
    await updateDoc(orderRef, { status });
  });
}

waiterLoginBtn.addEventListener("click", () => {
  loginWaiter(waiterCodeInput.value.trim());
});

// Auto-Login, falls schon bekannt
const storedRestId = loadWaiterSession();
if (storedRestId) {
  currentRestaurantId = storedRestId;
  kRestLabel.textContent = storedRestId;
  waiterLoginCard.style.display = "none";
  orderCard.style.display = "block";
  startOrderListener();
}
