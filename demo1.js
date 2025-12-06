// demo1.js – vereinfachte Gäste-Ansicht mit neuem Layout

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  increment,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

// URL-Parameter
const params = new URLSearchParams(window.location.search);
// HIER kannst du als Fallback z.B. deine shpija vjeter ID eintragen
const restaurantId = params.get("r") || "test-restaurant";
const tableId = params.get("t") || "T1";

// DOM: Restaurant
const restaurantLogoEl = document.getElementById("restaurantLogo");
const restaurantNameEl = document.getElementById("restaurantName");
const restaurantMetaEl = document.getElementById("restaurantMeta");

// DOM: Offers
const offersSection = document.getElementById("offersSection");
const offersSliderEl = document.getElementById("offersSlider");
const offersDotsEl = document.getElementById("offersDots");

// DOM: Status / Porosia / Kamarieri
const orderToggleBtn = document.getElementById("orderToggleBtn");
const orderDetailsContainer = document.getElementById("orderDetailsContainer");
const orderDetailsCard = document.getElementById("orderDetailsCard");
const orderStatusBadge = document.getElementById("orderStatusBadge");
const orderDetailsContent = document.getElementById("orderDetailsContent");
const callWaiterBtn = document.getElementById("callWaiterBtn");

// DOM: Suche, Drinks, Food
const searchInput = document.getElementById("searchInput");
const drinksSection = document.getElementById("drinksSection");
const drinksListEl = document.getElementById("drinksList");
const menuListEl = document.getElementById("menuList");

// STATE
let allMenuItems = [];
let drinksItems = [];
let foodItems = [];
let searchTerm = "";
let cart = [];

// OFFERS-SLIDER STATE
let offersSlides = [];
let offersCurrentIndex = 0;
let offersTimer = null;

// ORDER / CALL LISTENER
let orderDetailsOpen = false;
let unsubLatestOrder = null;
let unsubWaiterCall = null;

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
  } catch {
    // ignore
  }
}

function changeCart(item, delta) {
  const index = cart.findIndex((c) => c.id === item.id);
  if (index === -1 && delta > 0) {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: delta });
  } else if (index >= 0) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
  }
  saveCartToStorage();
}

/* =========================
   HELFER: ABO & STATUS
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
   LIKES: LOCALSTORAGE
   ========================= */

function likeKey(itemId) {
  return `menyra_like_${restaurantId}_${itemId}`;
}

function isItemLiked(itemId) {
  return localStorage.getItem(likeKey(itemId)) === "1";
}

function setItemLiked(itemId, liked) {
  if (liked) {
    localStorage.setItem(likeKey(itemId), "1");
  } else {
    localStorage.removeItem(likeKey(itemId));
  }
}

/* =========================
   OFFERS-SLIDER LOGIK
   ========================= */

function clearOffersTimer() {
  if (offersTimer) {
    clearInterval(offersTimer);
    offersTimer = null;
  }
}

function goToOffer(index) {
  if (!offersSlides.length || !offersSliderEl) return;
  if (index < 0 || index >= offersSlides.length) return;

  const slide = offersSlides[index];
  const offset = slide.offsetLeft - offersSliderEl.offsetLeft;

  offersSliderEl.scrollTo({
    left: offset,
    behavior: "smooth",
  });

  offersCurrentIndex = index;
  const dots = offersDotsEl.querySelectorAll(".offers-dot");
  dots.forEach((d, i) => d.classList.toggle("active", i === index));
}

function startOffersAutoSlide() {
  clearOffersTimer();
  if (offersSlides.length <= 1) return;
  offersTimer = setInterval(() => {
    const next = (offersCurrentIndex + 1) % offersSlides.length;
    goToOffer(next);
  }, 5000);
}

async function loadOffersForRestaurant(restaurantRef, restData) {
  if (restData.offerActive === false) {
    offersSection.style.display = "none";
    clearOffersTimer();
    return;
  }

  const offersCol = collection(restaurantRef, "offers");
  const snap = await getDocs(offersCol);
  const offers = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d.active === false) return;
    offers.push({
      id: docSnap.id,
      ...d,
    });
  });

  if (!offers.length) {
    offersSection.style.display = "none";
    clearOffersTimer();
    return;
  }

  renderOffersSlider(offers);
}

function renderOffersSlider(offers) {
  offersSliderEl.innerHTML = "";
  offersDotsEl.innerHTML = "";
  offersSection.style.display = "block";

  const slidesFrag = document.createDocumentFragment();
  const dotsFrag = document.createDocumentFragment();

  offers.forEach((offer, index) => {
    let linkedMenuItem = null;
    if (offer.menuItemId) {
      linkedMenuItem =
        allMenuItems.find((m) => m.id === offer.menuItemId) || null;
    }

    const title =
      offer.title || (linkedMenuItem ? linkedMenuItem.name : "Ofertë");
    const description =
      offer.description || (linkedMenuItem ? linkedMenuItem.description : "");
    const imageUrl =
      offer.imageUrl || (linkedMenuItem ? linkedMenuItem.imageUrl : null);

    let price = null;
    if (typeof offer.price === "number") {
      price = offer.price;
    } else if (linkedMenuItem && typeof linkedMenuItem.price === "number") {
      price = linkedMenuItem.price;
    }

    const slide = document.createElement("article");
    slide.className = "offer-slide";

    // Bild
    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = title;
      img.loading = "lazy";
      img.className = "offer-image";
      slide.appendChild(img);
    }

    // Header (Titel + Preis)
    const header = document.createElement("div");
    header.className = "offer-header";

    const titleEl = document.createElement("div");
    titleEl.className = "offer-title";
    titleEl.textContent = title;

    const priceEl = document.createElement("div");
    priceEl.className = "offer-price";
    priceEl.textContent =
      typeof price === "number" ? price.toFixed(2) + " €" : "";

    header.appendChild(titleEl);
    header.appendChild(priceEl);
    slide.appendChild(header);

    // Beschreibung
    if (description) {
      const descEl = document.createElement("div");
      descEl.className = "offer-desc";
      descEl.textContent = description;
      slide.appendChild(descEl);
    }

    // Info-only Text (kein Direkt-Add to Cart in Demo)
    const infoOnly = document.createElement("div");
    infoOnly.className = "offer-info-only";
    infoOnly.textContent = "Vetëm informacion / ofertë vizuale.";
    slide.appendChild(infoOnly);

    slidesFrag.appendChild(slide);

    // Dot
    const dot = document.createElement("button");
    dot.className = "offers-dot" + (index === 0 ? " active" : "");
    dot.dataset.index = String(index);
    dot.addEventListener("click", () => {
      goToOffer(index);
      startOffersAutoSlide();
    });
    dotsFrag.appendChild(dot);
  });

  offersSliderEl.appendChild(slidesFrag);
  offersDotsEl.appendChild(dotsFrag);

  offersSlides = Array.from(offersSliderEl.querySelectorAll(".offer-slide"));
  offersCurrentIndex = 0;
  startOffersAutoSlide();

  // Sync aktiv Dot beim Scroll
  offersSliderEl.addEventListener("scroll", () => {
    if (!offersSlides.length) return;
    const center = offersSliderEl.scrollLeft + offersSliderEl.clientWidth / 2;
    let bestIndex = 0;
    let bestDist = Infinity;
    offersSlides.forEach((slide, i) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(slideCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    });
    offersCurrentIndex = bestIndex;
    const dots = offersDotsEl.querySelectorAll(".offers-dot");
    dots.forEach((d, i) => d.classList.toggle("active", i === bestIndex));
  });
}

/* =========================
   RESTAURANT & MENÜ LADEN
   ========================= */

function inferTypeForItem(item) {
  if (item.type === "food" || item.type === "drink") return item.type;

  const cat = (item.category || "").toLowerCase();
  const drinksWords = [
    "getränke",
    "drinks",
    "freskuese",
    "kafe",
    "cafe",
    "çaj",
    "caj",
    "ujë",
    "uje",
    "lëngje",
    "lengje",
    "birra",
    "beer",
    "wine",
    "verë",
    "vere",
    "cocktail",
  ];
  if (drinksWords.some((w) => cat.includes(w))) return "drink";
  return "food";
}

async function loadRestaurantAndMenu() {
  try {
    const restaurantRef = doc(db, "restaurants", restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      restaurantNameEl.textContent = "Lokal nicht gefunden";
      restaurantMetaEl.textContent = `ID: ${restaurantId}`;
      menuListEl.innerHTML = "<p>Bitte Personal informieren.</p>";
      offersSection.style.display = "none";
      drinksSection.style.display = "none";
      return;
    }

    const data = restaurantSnap.data();

    restaurantNameEl.textContent = data.restaurantName || "Lokal";
    restaurantMetaEl.textContent =
      data.subtitle || "Mirësevini në menynë digjitale.";

    if (data.logoUrl) {
      restaurantLogoEl.src = data.logoUrl;
      restaurantLogoEl.style.display = "block";
    }

    if (!isRestaurantOperational(data)) {
      menuListEl.innerHTML =
        "<p>Ky MENYRA nuk është aktiv aktualisht. Ju lutem njoftoni stafin.</p>";
      offersSection.style.display = "none";
      drinksSection.style.display = "none";
      return;
    }

    const menuCol = collection(restaurantRef, "menuItems");
    const snap = await getDocs(menuCol);

    let items = snap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || "Produkt",
          description: d.description || "",
          longDescription: d.longDescription || "",
          price: d.price || 0,
          category: d.category || "Sonstiges",
          available: d.available !== false,
          imageUrl: d.imageUrl || null,
          type: d.type || null,
          likeCount: d.likeCount || 0,
          commentCount: d.commentCount || 0,
        };
      })
      .filter((i) => i.available);

    items = items.map((i) => ({
      ...i,
      type: inferTypeForItem(i),
    }));

    allMenuItems = items;
    drinksItems = allMenuItems.filter((i) => i.type === "drink");
    foodItems = allMenuItems.filter((i) => i.type === "food");

    renderDrinks();
    renderMenu();
    await loadOffersForRestaurant(restaurantRef, data);
  } catch (err) {
    console.error(err);
    restaurantNameEl.textContent = "Fehler";
    restaurantMetaEl.textContent = err.message;
  }
}

/* =========================
   GETRÄNKE RENDERING
   ========================= */

function renderDrinks() {
  drinksListEl.innerHTML = "";

  if (!drinksItems.length) {
    drinksSection.style.display = "none";
    return;
  }

  drinksSection.style.display = "block";

  let items = [...drinksItems];
  if (searchTerm) {
    const q = searchTerm;
    items = items.filter((i) => {
      const txt = `${i.name} ${i.description}`.toLowerCase();
      return txt.includes(q);
    });
  }

  if (!items.length) {
    drinksListEl.innerHTML = "<p style='font-size:0.8rem;'>S'ka pije për këtë kërkim.</p>";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "drink-item";

    // Topbar mit Herz
    const topbar = document.createElement("div");
    topbar.className = "drink-topbar";

    const likeWrap = document.createElement("div");
    likeWrap.className =
      "like-wrap" + (isItemLiked(item.id) ? " is-liked" : "");
    likeWrap.dataset.itemId = item.id;

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = "icon-circle";
    likeBtn.setAttribute("aria-label", "Like");

    const iconInner = document.createElement("span");
    iconInner.className = "icon-circle__inner";
    iconInner.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          class="heart-path"
          d="M12.001 4.529c2.349-2.532 6.533-2.036 8.426.758 1.222 1.79 1.347 4.582-.835 7.086-1.803 2.08-4.822 4.403-7.296 5.876a1.25 1.25 0 0 1-1.292 0c-2.474-1.473-5.493-3.797-7.296-5.876-2.182-2.504-2.057-5.296-.835-7.086 1.893-2.794 6.077-3.29 8.428-.758z"
        />
      </svg>
    `;
    likeBtn.appendChild(iconInner);

    const countSpan = document.createElement("span");
    countSpan.className = "like-count";
    countSpan.textContent = String(item.likeCount || 0);

    likeWrap.appendChild(likeBtn);
    likeWrap.appendChild(countSpan);
    topbar.appendChild(likeWrap);
    card.appendChild(topbar);

    likeBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await toggleItemLike(item, likeWrap);
    });

    // Bild
    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.className = "drink-image";
      img.loading = "lazy";
      card.appendChild(img);
    }

    // Name + Preis
    const header = document.createElement("div");
    header.className = "drink-header";

    const nameEl = document.createElement("div");
    nameEl.className = "drink-name";
    nameEl.textContent = item.name;

    const priceEl = document.createElement("div");
    priceEl.className = "drink-price";
    priceEl.textContent = item.price.toFixed(2) + " €";

    header.appendChild(nameEl);
    header.appendChild(priceEl);
    card.appendChild(header);

    if (item.description) {
      const descEl = document.createElement("div");
      descEl.className = "drink-desc";
      descEl.textContent = item.description;
      card.appendChild(descEl);
    }

    // Footer: Menge + Zgjidh
    const footer = document.createElement("div");
    footer.className = "drink-footer";

    const qtyControl = document.createElement("div");
    qtyControl.className = "qty-control";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "qty-btn";
    minusBtn.textContent = "−";

    const qtyValue = document.createElement("span");
    qtyValue.className = "qty-value";
    let currentQty = 1;
    qtyValue.textContent = "1";

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "qty-btn";
    plusBtn.textContent = "+";

    minusBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (currentQty > 1) {
        currentQty--;
        qtyValue.textContent = String(currentQty);
      }
    });

    plusBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      currentQty++;
      qtyValue.textContent = String(currentQty);
    });

    qtyControl.appendChild(minusBtn);
    qtyControl.appendChild(qtyValue);
    qtyControl.appendChild(plusBtn);

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn-add-round";
    addBtn.textContent = "Zgjidh";

    addBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      changeCart(item, currentQty);
    });

    footer.appendChild(qtyControl);
    footer.appendChild(addBtn);
    card.appendChild(footer);

    drinksListEl.appendChild(card);
  });
}

/* =========================
   SPEISEKARTE RENDERING
   ========================= */

function renderMenu() {
  menuListEl.innerHTML = "";

  let items = [...foodItems];
  if (searchTerm) {
    const q = searchTerm;
    items = items.filter((i) => {
      const txt = `${i.name} ${i.description} ${i.longDescription}`.toLowerCase();
      return txt.includes(q);
    });
  }

  if (!items.length) {
    menuListEl.innerHTML =
      "<p style='font-size:0.8rem;'>Nuk ka produkte për këtë kërkim.</p>";
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "menu-item";

    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.className = "menu-image";
      img.loading = "lazy";
      card.appendChild(img);
    }

    const header = document.createElement("div");
    header.className = "menu-name-row";

    const nameEl = document.createElement("div");
    nameEl.className = "menu-name";
    nameEl.textContent = item.name;

    const priceEl = document.createElement("div");
    priceEl.className = "menu-price";
    priceEl.textContent = item.price.toFixed(2) + " €";

    header.appendChild(nameEl);
    header.appendChild(priceEl);
    card.appendChild(header);

    const descEl = document.createElement("div");
    descEl.className = "menu-desc";
    descEl.textContent = item.description;
    card.appendChild(descEl);

    const footer = document.createElement("div");
    footer.className = "menu-footer";

    const likeBox = document.createElement("div");
    likeBox.className = "menu-like";
    likeBox.innerHTML = `
      <span class="menu-like-icon">♥</span>
      <span>${item.likeCount || 0}</span>
    `;
    footer.appendChild(likeBox);

    const actions = document.createElement("div");
    actions.className = "menu-actions";

    const detailsBtn = document.createElement("button");
    detailsBtn.type = "button";
    detailsBtn.className = "menu-btn";
    detailsBtn.textContent = "Detaje";
    detailsBtn.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.pathname = "detajet.html";
      url.searchParams.set("r", restaurantId);
      url.searchParams.set("t", tableId);
      url.searchParams.set("item", item.id);
      window.location.href = url.toString();
    });

    const chooseBtn = document.createElement("button");
    chooseBtn.type = "button";
    chooseBtn.className = "menu-btn menu-btn--primary";
    chooseBtn.textContent = "Zgjidh";
    chooseBtn.addEventListener("click", () => {
      changeCart(item, 1);
    });

    actions.appendChild(detailsBtn);
    actions.appendChild(chooseBtn);
    footer.appendChild(actions);

    card.appendChild(footer);
    menuListEl.appendChild(card);
  });
}

/* =========================
   LIKE Firestore-Update
   ========================= */

async function toggleItemLike(item, likeWrapEl = null) {
  const likedBefore = isItemLiked(item.id);
  const likedAfter = !likedBefore;
  setItemLiked(item.id, likedAfter);

  const modelItem = allMenuItems.find((i) => i.id === item.id);
  if (modelItem) {
    if (!modelItem.likeCount) modelItem.likeCount = 0;
    modelItem.likeCount += likedAfter ? 1 : -1;
    if (modelItem.likeCount < 0) modelItem.likeCount = 0;
  }
  item.likeCount = modelItem ? modelItem.likeCount : item.likeCount;

  if (likeWrapEl) {
    if (likedAfter) likeWrapEl.classList.add("is-liked");
    else likeWrapEl.classList.remove("is-liked");

    const countEl = likeWrapEl.querySelector(".like-count");
    if (countEl) countEl.textContent = String(item.likeCount || 0);
  }

  try {
    const restRef = doc(db, "restaurants", restaurantId);
    const menuCol = collection(restRef, "menuItems");
    const itemRef = doc(menuCol, item.id);
    await updateDoc(itemRef, {
      likeCount: increment(likedAfter ? 1 : -1),
    });
  } catch (err) {
    console.error(err);
  }

  // aktualisiere Food-Likes auch
  renderMenu();
}

/* =========================
   ORDER OVERVIEW
   ========================= */

function mapGuestOrderStatus(status) {
  const s = status || "new";
  if (s === "new") {
    return { label: "Neu", badgeClass: "order-status-badge--new" };
  }
  if (s === "in_progress") {
    return { label: "Në përgatitje", badgeClass: "order-status-badge--in-progress" };
  }
  if (s === "served") {
    return { label: "Serviert", badgeClass: "order-status-badge--served" };
  }
  if (s === "paid") {
    return { label: "Paguar", badgeClass: "order-status-badge--paid" };
  }
  return { label: s, badgeClass: "order-status-badge--empty" };
}

function renderOrderEmpty() {
  orderStatusBadge.textContent = "S'ka porosi";
  orderStatusBadge.className = "order-status-badge order-status-badge--empty";
  orderDetailsContent.textContent = "Ende nuk keni porositur.";
}

function renderLatestOrder(latest) {
  const { label, badgeClass } = mapGuestOrderStatus(latest.status);
  orderStatusBadge.textContent = label;
  orderStatusBadge.className = "order-status-badge " + badgeClass;

  const items = latest.items || [];
  if (!items.length) {
    orderDetailsContent.textContent =
      "Porosia është regjistruar, por artikujt nuk janë gjetur.";
    return;
  }

  const total = items.reduce(
    (sum, i) =>
      sum + (Number(i.price) || 0) * (Number(i.qty) || 0),
    0
  );

  const lines = items
    .map((i) => {
      const qty = i.qty || 0;
      const name = i.name || "";
      const rowTotal =
        (Number(i.price) || 0) * (Number(i.qty) || 0);
      return `
        <div class="order-item-row">
          <span class="order-item-name">${qty}× ${name}</span>
          <span class="order-item-price">${rowTotal.toFixed(2)} €</span>
        </div>
      `;
    })
    .join("");

  orderDetailsContent.innerHTML = `
    <div class="order-items-list">
      ${lines}
    </div>
    <div class="order-summary-row">
      <span>Totali</span>
      <span>${total.toFixed(2)} €</span>
    </div>
  `;
}

function startLatestOrderListener() {
  const ordersCol = collection(db, "restaurants", restaurantId, "orders");
  const qOrders = query(ordersCol, orderBy("createdAt", "desc"));

  unsubLatestOrder = onSnapshot(
    qOrders,
    (snap) => {
      let found = null;
      snap.forEach((docSnap) => {
        if (found) return;
        const data = docSnap.data();
        const tableField = data.table || data.tableId;
        if (tableField === tableId) {
          found = { id: docSnap.id, ...data };
        }
      });

      if (!found) renderOrderEmpty();
      else renderLatestOrder(found);
    },
    (err) => {
      console.error("[DEMO] OrderListener Fehler:", err);
      renderOrderEmpty();
    }
  );
}

function openOrderDetails() {
  orderDetailsOpen = true;
  orderToggleBtn.classList.add("order-toggle-btn--active");
  orderToggleBtn.textContent = "Shiko porosinë -";
  orderDetailsContainer.style.display = "block";
  requestAnimationFrame(() => {
    orderDetailsCard.classList.add("order-details-card--open");
  });
}

function closeOrderDetails() {
  orderDetailsOpen = false;
  orderToggleBtn.classList.remove("order-toggle-btn--active");
  orderToggleBtn.textContent = "Shiko porosinë +";
  orderDetailsCard.classList.remove("order-details-card--open");
  setTimeout(() => {
    if (!orderDetailsOpen) {
      orderDetailsContainer.style.display = "none";
    }
  }, 220);
}

/* =========================
   THIRR KAMARIERIN
   ========================= */

function updateWaiterCallUI(hasOpen) {
  if (hasOpen) {
    callWaiterBtn.textContent = "Kamarieri vjen";
    callWaiterBtn.classList.add("call-waiter-btn--active");
  } else {
    callWaiterBtn.textContent = "Thirr kamarierin";
    callWaiterBtn.classList.remove("call-waiter-btn--active");
  }
}

function startWaiterCallListener() {
  const callsCol = collection(db, "restaurants", restaurantId, "calls");
  const qCalls = query(
    callsCol,
    where("tableId", "==", tableId),
    where("status", "==", "open")
  );

  unsubWaiterCall = onSnapshot(
    qCalls,
    (snap) => {
      const hasOpen = !snap.empty;
      updateWaiterCallUI(hasOpen);
    },
    (err) => {
      console.error("[DEMO] WaiterCallListener Fehler:", err);
    }
  );
}

async function handleCallWaiter() {
  callWaiterBtn.disabled = true;
  try {
    const callsCol = collection(db, "restaurants", restaurantId, "calls");
    const qOpen = query(
      callsCol,
      where("tableId", "==", tableId),
      where("status", "==", "open")
    );
    const snap = await getDocs(qOpen);

    if (snap.empty) {
      await addDoc(callsCol, {
        tableId,
        table: tableId,
        status: "open",
        createdAt: serverTimestamp(),
      });
    }
    updateWaiterCallUI(true);
  } catch (err) {
    console.error("[DEMO] Fehler bei Thirr kamarierin:", err);
    alert("Thirrja nuk u dërgua, provo përsëri.");
  } finally {
    callWaiterBtn.disabled = false;
  }
}

/* =========================
   EVENTS & INIT
   ========================= */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchTerm = (searchInput.value || "").trim().toLowerCase();
    renderDrinks();
    renderMenu();
  });
}

if (orderToggleBtn) {
  orderToggleBtn.addEventListener("click", () => {
    if (orderDetailsOpen) closeOrderDetails();
    else openOrderDetails();
  });
}

if (callWaiterBtn) {
  callWaiterBtn.addEventListener("click", () => {
    handleCallWaiter();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  cart = loadCartFromStorage();
  loadRestaurantAndMenu();
  startLatestOrderListener();
  startWaiterCallListener();
});
