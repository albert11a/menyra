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
  orderBy,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const kRestLabel = document.getElementById("kRestLabel");
const waiterLoginCard = document.getElementById("waiterLoginCard");
const waiterCodeInput = document.getElementById("waiterCodeInput");
const waiterLoginBtn = document.getElementById("waiterLoginBtn");
const waiterLoginStatus = document.getElementById("waiterLoginStatus");

const orderCard = document.getElementById("orderCard");
const orderList = document.getElementById("orderList");
const statusFilterRow = document.getElementById("statusFilterRow");

const waiterCallsCard = document.getElementById("waiterCallsCard");
const waiterCallsList = document.getElementById("waiterCallsList");

let currentRestaurantId = null;
let unsubOrders = null;
let unsubCalls = null;
let allOrders = [];
let waiterCalls = [];
let statusFilter = "all";

/* =========================
   SESSION
   ========================= */

function saveWaiterSession(restaurantId) {
  localStorage.setItem("menyra_waiter_restaurantId", restaurantId);
}

function loadWaiterSession() {
  return localStorage.getItem("menyra_waiter_restaurantId");
}

/* =========================
   ABO / STATUS
   ========================= */

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

/* =========================
   STATUS LABELS
   ========================= */

function mapStatusLabel(status) {
  if (status === "new") return "Neu";
  if (status === "in_progress") return "In Arbeit";
  if (status === "served") return "Serviert";
  if (status === "paid") return "Bezahlt";
  return status || "";
}

function getStatusColors(status) {
  if (status === "new") return { bg: "#dbeafe", fg: "#1d4ed8" };
  if (status === "in_progress") return { bg: "#fef9c3", fg: "#a16207" };
  if (status === "served") return { bg: "#e5e7eb", fg: "#374151" };
  if (status === "paid") return { bg: "#dcfce7", fg: "#166534" };
  return { bg: "#e5e7eb", fg: "#374151" };
}

/* =========================
   LOGIN KELLNER
   ========================= */

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
      waiterLoginStatus.textContent =
        "Kein Lokal mit diesem Kellner-Code gefunden.";
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
    console.log("[KAMARIERI] Login Restaurant:", currentRestaurantId);
    saveWaiterSession(currentRestaurantId);

    kRestLabel.textContent = data.restaurantName || currentRestaurantId;
    waiterLoginCard.style.display = "none";
    orderCard.style.display = "block";
    waiterCallsCard.style.display = "block";

    startOrderListener();
    startCallsListener();
  } catch (err) {
    console.error(err);
    waiterLoginStatus.textContent = "Fehler: " + err.message;
    waiterLoginStatus.classList.add("status-err");
  } finally {
    waiterLoginBtn.disabled = false;
    waiterLoginBtn.textContent = "Einloggen";
  }
}

/* =========================
   ORDERS RENDERING
   ========================= */

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
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn btn-ghost btn-small" data-id="${o.id}" data-status="in_progress">
          In Arbeit
        </button>
        <button class="btn btn-ghost btn-small" data-id="${o.id}" data-status="served">
          Serviert
        </button>
        <button class="btn btn-primary btn-small" data-id="${o.id}" data-status="paid">
          Bezahlt
        </button>
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

/* =========================
   FIRESTORE LISTENER ORDERS
   ========================= */

function startOrderListener() {
  if (!currentRestaurantId) return;
  if (unsubOrders) unsubOrders();

  console.log("[KAMARIERI] Starte Orders-Listener für:", currentRestaurantId);

  const ordersCol = collection(db, "restaurants", currentRestaurantId, "orders");
  const qOrders = query(ordersCol, orderBy("createdAt", "desc"));

  unsubOrders = onSnapshot(
    qOrders,
    (snap) => {
      const orders = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const ts = data.createdAt;
        let createdAtText = "";

        if (ts && typeof ts.toDate === "function") {
          createdAtText = ts.toDate().toLocaleTimeString("de-AT", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        orders.push({
          id: docSnap.id,
          table: data.table || "?",
          items: data.items || [],
          status: data.status || "new",
          createdAtText,
        });
      });

      console.log("[KAMARIERI] Orders Snapshot:", orders);
      allOrders = orders;
      renderOrdersWithFilter();
    },
    (error) => {
      console.error("[KAMARIERI] onSnapshot Fehler:", error);
      orderList.innerHTML =
        "<div class='info'>Fehler beim Laden der Bestellungen.</div>";
    }
  );
}

/* =========================
   FIRESTORE LISTENER CALLS
   ========================= */

function renderWaiterCalls() {
  if (!waiterCallsCard || !waiterCallsList) return;

  waiterCallsList.innerHTML = "";

  if (!waiterCalls.length) {
    waiterCallsCard.style.display = "none";
    return;
  }

  waiterCallsCard.style.display = "block";

  waiterCalls.forEach((c) => {
    const row = document.createElement("div");
    row.className = "list-item-row waiter-call-row";
    row.innerHTML = `
      <span>
        Tisch ${c.table}
        <br/>
        <span class="info">
          Hat nach einem Kellner gerufen${c.createdAtText ? " • " + c.createdAtText : ""}.
        </span>
      </span>
      <button
        class="btn btn-small btn-primary"
        data-call-id="${c.id}"
      >
        U kry
      </button>
    `;
    waiterCallsList.appendChild(row);
  });
}

function startCallsListener() {
  if (!currentRestaurantId) return;
  if (unsubCalls) unsubCalls();

  console.log("[KAMARIERI] Starte Calls-Listener für:", currentRestaurantId);

  const callsCol = collection(db, "restaurants", currentRestaurantId, "calls");
  const qCalls = query(
    callsCol,
    where("status", "==", "open")
  );

  unsubCalls = onSnapshot(
    qCalls,
    (snap) => {
      const calls = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const ts = data.createdAt;
        let createdAtText = "";
        if (ts && typeof ts.toDate === "function") {
          createdAtText = ts.toDate().toLocaleTimeString("de-AT", {
            hour: "2-digit",
            minute: "2-digit",
          });
        }

        calls.push({
          id: docSnap.id,
          table: data.table || data.tableId || "?",
          createdAtText,
        });
      });

      waiterCalls = calls;
      renderWaiterCalls();
    },
    (error) => {
      console.error("[KAMARIERI] Calls Listener Fehler:", error);
      waiterCallsList.innerHTML =
        "<div class='info'>Fehler beim Laden der Thirrje.</div>";
    }
  );
}

/* =========================
   EVENTS
   ========================= */

waiterLoginBtn.addEventListener("click", () => {
  loginWaiter(waiterCodeInput.value.trim());
});

// Filter-Buttons: Alle / Neu / In Arbeit / Serviert
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

// Status-Buttons auf Order-Cards
orderList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;

  const id = btn.dataset.id;
  const status = btn.dataset.status;
  if (!id || !status || !currentRestaurantId) return;

  const orderRef = doc(db, "restaurants", currentRestaurantId, "orders", id);
  try {
    await updateDoc(orderRef, { status });
  } catch (err) {
    console.error("[KAMARIERI] Status Update Error:", err);
  }
});

// „U kry“ für Thirrje
waiterCallsList.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-call-id]");
  if (!btn) return;
  const id = btn.dataset.callId;
  if (!id || !currentRestaurantId) return;

  const callRef = doc(db, "restaurants", currentRestaurantId, "calls", id);
  try {
    await updateDoc(callRef, { status: "done" });
  } catch (err) {
    console.error("[KAMARIERI] Call Update Error:", err);
  }
});

/* =========================
   AUTO-LOGIN (wenn Session da)
   ========================= */

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
      console.log("[KAMARIERI] Auto-Login Restaurant:", currentRestaurantId);
      kRestLabel.textContent = data.restaurantName || currentRestaurantId;
      waiterLoginCard.style.display = "none";
      orderCard.style.display = "block";

      startOrderListener();
      startCallsListener();
    } catch (err) {
      console.error(err);
    }
  })();
}
