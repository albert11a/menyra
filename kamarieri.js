import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDocs,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const kRestLabel = document.getElementById("kRestLabel");
const waiterLoginCard = document.getElementById("waiterLoginCard");
const waiterCodeInput = document.getElementById("waiterCodeInput");
const waiterLoginBtn = document.getElementById("waiterLoginBtn");
const waiterLoginStatus = document.getElementById("waiterLoginStatus");
const orderCard = document.getElementById("orderCard");
const orderList = document.getElementById("orderList");
const statusFilterRow = document.getElementById("statusFilterRow");

let currentRestaurantId = null;
let unsubOrders = null;
let allOrders = [];
let statusFilter = "all";

function saveWaiterSession(restaurantId) {
  localStorage.setItem("menyra_waiter_restaurantId", restaurantId);
}

function loadWaiterSession() {
  return localStorage.getItem("menyra_waiter_restaurantId");
}

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

function mapStatusLabel(status) {
  if (status === "new") return "Neu";
  if (status === "in_progress") return "In Arbeit";
  if (status === "served") return "Serviert";
  return status || "";
}

function getStatusColors(status) {
  if (status === "new") return { bg: "#dbeafe", fg: "#1d4ed8" };
  if (status === "in_progress") return { bg: "#fef9c3", fg: "#a16207" };
  if (status === "served") return { bg: "#e5e7eb", fg: "#374151" };
  return { bg: "#e5e7eb", fg: "#374151" };
}

async function loginWaiter(code) {
  waiterLoginStatus.textContent = "";
  waiterLoginStatus.className = "status-text";

  if (!code) {
    waiterLoginStatus.textContent = "Bitte Kellner-Code eingeben.";
    waiterLoginStatus.classList.add("status-err");
    return;
  }

  try {
    waiterLoginBtn.disabled = true;
    waiterLoginBtn.textContent = "Prüfe...";

    const qRest = query(
      collection(db, "restaurants"),
      where("waiterCode", "==", code)
    );
    const snap = await getDocs(qRest);

    if (snap.empty) {
      waiterLoginStatus.textContent = "Kein Lokal mit diesem Kellner-Code gefunden.";
      waiterLoginStatus.classList.add("status-err");
      return;
    }

    const docSnap = snap.docs[0];
    const data = docSnap.data();

    if (!isRestaurantOperational(data)) {
      waiterLoginStatus.textContent =
        "Dieses MENYRA ist aktuell nicht aktiv. Bitte Chef oder MENYRA kontaktieren.";
      waiterLoginStatus.classList.add("status-err");
      return;
    }

    currentRestaurantId = docSnap.id;
    saveWaiterSession(currentRestaurantId);

    kRestLabel.textContent = data.restaurantName || currentRestaurantId;
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

    const label = mapStatusLabel(o.status);
    const colors = getStatusColors(o.status);
    const itemsText = (o.items || [])
      .map((i) => `${i.qty}× ${i.name}`)
      .join(", ");
    const total =
      (o.items || []).reduce(
        (sum, i) => sum + (i.price || 0) * (i.qty || 0),
        0
      ) || 0;

    div.innerHTML = `
      <div class="list-item-row">
        <span>
          Tisch ${o.table}
          <br/>
          <span class="info">${itemsText}</span>
        </span>
        <span class="badge" style="background:${colors.bg}; color:${colors.fg};">
          ${label}
        </span>
      </div>
      <div class="info">
        ${o.createdAtText || ""} • Summe: ${total.toFixed(2)} €
      </div>
      <div style="margin-top:8px; display:flex; gap:6px;">
        <button class="btn btn-ghost btn-small" data-id="${o.id}" data-status="in_progress">In Arbeit</button>
        <button class="btn btn-primary btn-small" data-id="${o.id}" data-status="served">Serviert</button>
      </div>
    `;
    orderList.appendChild(div);
  });
}

function renderOrdersWithFilter() {
  let filtered = allOrders;
  if (statusFilter !== "all") {
    filtered = allOrders.filter((o) => o.status === statusFilter);
  }
  renderOrders(filtered);
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

    orders.sort((a, b) => (a.createdAtText < b.createdAtText ? 1 : -1));
    allOrders = orders;
    renderOrdersWithFilter();
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

statusFilterRow.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;
  statusFilter = btn.dataset.filter;

  const allButtons = statusFilterRow.querySelectorAll("button[data-filter]");
  allButtons.forEach((b) => {
    if (b.dataset.filter === statusFilter) {
      b.classList.remove("btn-ghost");
      b.classList.add("btn-primary");
    } else {
      b.classList.remove("btn-primary");
      b.classList.add("btn-ghost");
    }
  });

  renderOrdersWithFilter();
});

// Auto-Login falls schon bekannt
const storedRestId = loadWaiterSession();
if (storedRestId) {
  (async () => {
    try {
      const ref = doc(db, "restaurants", storedRestId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const data = snap.data();
      if (!isRestaurantOperational(data)) return;

      currentRestaurantId = storedRestId;
      kRestLabel.textContent = data.restaurantName || currentRestaurantId;
      waiterLoginCard.style.display = "none";
      orderCard.style.display = "block";
      startOrderListener();
    } catch (err) {
      console.error(err);
    }
  })();
}
