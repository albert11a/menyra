// karte.js – Gäste-Ansicht mit Logo, Suche, Kategorien, Offers-Slider & Floating Cart-FAB

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

const restaurantLogoEl = document.getElementById("restaurantLogo");
const restaurantNameEl = document.getElementById("restaurantName");
const restaurantMetaEl = document.getElementById("restaurantMeta");

// TABS & LISTEN
const drinksSection = document.getElementById("drinksSection");
const drinksTabsWrapper = document.getElementById("drinksTabsWrapper");
const drinksTabsEl = document.getElementById("drinksTabs");
const drinksListEl = document.getElementById("drinksList");

const foodTabsWrapper = document.getElementById("foodTabsWrapper");
const foodCategoryTabsEl = document.getElementById("foodCategoryTabs");
const menuListEl = document.getElementById("menuList");

// OFFERS
const offersSection = document.getElementById("offersSection");
const offersSliderEl = document.getElementById("offersSlider");
const offersDotsEl = document.getElementById("offersDots");

// WARENKORB (inline Card)
const cartSection = document.getElementById("cartSection");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const clearCartBtn = document.getElementById("clearCartBtn");
const sendOrderBtn = document.getElementById("sendOrderBtn");
const noteInput = document.getElementById("noteInput");
const statusMsg = document.getElementById("statusMsg");
const cartTableLabel = document.getElementById("cartTableLabel");

// SUCHE & FAB
const searchInput = document.getElementById("searchInput");
const cartFab = document.getElementById("cartFab");
const cartFabLabel = document.getElementById("cartFabLabel");
const cartBadgeEl = document.getElementById("cartBadge");

// PRODUKT-DETAIL DRAWER
const productDetailOverlay = document.getElementById("productDetailOverlay");
const productDetailDrawer = document.getElementById("productDetailDrawer");
const detailImageEl = document.getElementById("detailImage");
const detailTitleEl = document.getElementById("detailTitle");
const detailPriceEl = document.getElementById("detailPrice");
const detailLongDescEl = document.getElementById("detailLongDesc");
const detailZutatenEl = document.getElementById("detailZutaten");
const detailQtyMinusBtn = document.getElementById("detailQtyMinus");
const detailQtyPlusBtn = document.getElementById("detailQtyPlus");
const detailQtyValueEl = document.getElementById("detailQtyValue");
const detailAddBtn = document.getElementById("detailAddBtn");
const detailCloseBtn = document.getElementById("detailCloseBtn");

// CART DRAWER
const cartDrawerOverlay = document.getElementById("cartDrawerOverlay");
const cartDrawer = document.getElementById("cartDrawer");
const cartDrawerCloseBtn = document.getElementById("cartDrawerCloseBtn");
const cartDrawerItemsEl = document.getElementById("cartDrawerItems");
const cartDrawerTotalEl = document.getElementById("cartDrawerTotal");
const cartDrawerClearBtn = document.getElementById("cartDrawerClearBtn");
const cartDrawerSendBtn = document.getElementById("cartDrawerSendBtn");

let allMenuItems = [];      // alle Produkte mit type
let drinksItems = [];       // type === 'drink'
let foodItems = [];         // type === 'food'

let activeFoodCategory = "Alle";
let activeDrinksCategory = null;
let searchTerm = "";
let cart = [];

// Offers Slider State
let offersSlides = [];
let offersCurrentIndex = 0;
let offersTimer = null;

// Detail-Drawer State
let currentDetailItem = null;
let currentDetailQty = 1;

cartTableLabel.textContent = `Tisch ${tableId}`;

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
  }, 4000);
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

  const dotsFrag = document.createDocumentFragment();
  const slidesFrag = document.createDocumentFragment();

  offers.forEach((offer, index) => {
    let linkedMenuItem = null;
    if (offer.menuItemId) {
      linkedMenuItem =
        allMenuItems.find((m) => m.id === offer.menuItemId) || null;
    }

    const title =
      offer.title || (linkedMenuItem ? linkedMenuItem.name : "Angebot");
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

    const addToCart = offer.addToCart === true;

    const slide = document.createElement("div");
    slide.className = "offer-slide";

    if (imageUrl) {
      const img = document.createElement("img");
      img.src = imageUrl;
      img.alt = title;
      img.loading = "lazy";
      img.className = "offer-image";
      slide.appendChild(img);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "offer-image";
      slide.appendChild(placeholder);
    }

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

    const descEl = document.createElement("div");
    descEl.className = "offer-desc";
    descEl.textContent = description || "";
    slide.appendChild(descEl);

    if (addToCart && (linkedMenuItem || typeof price === "number")) {
      const actions = document.createElement("div");
      actions.className = "offer-actions";

      const minusBtn = document.createElement("button");
      minusBtn.className = "btn btn-ghost";
      minusBtn.textContent = "−";

      const plusBtn = document.createElement("button");
      plusBtn.className = "btn btn-primary";
      plusBtn.textContent = "Hinzufügen";

      const targetItem = linkedMenuItem
        ? linkedMenuItem
        : {
            id: "offer:" + offer.id,
            name: title,
            price: price || 0,
          };

      minusBtn.addEventListener("click", () => {
        changeCart(targetItem, -1);
      });
      plusBtn.addEventListener("click", () => {
        changeCart(targetItem, 1);
      });

      actions.appendChild(minusBtn);
      actions.appendChild(plusBtn);
      slide.appendChild(actions);
    } else {
      const infoOnly = document.createElement("div");
      infoOnly.className = "offer-info-only";
      infoOnly.textContent =
        "Vetëm informacion / reklamë – jo e porositshme direkt.";
      slide.appendChild(infoOnly);
    }

    slidesFrag.appendChild(slide);

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
    "getraenke",
    "drinks",
    "freskuese",
    "cafe",
    "kafe",
    "kafe & espresso",
    "cappuccino",
    "latte",
    "çaj",
    "caj",
    "ujë",
    "uje",
    "lëngje",
    "lengje",
    "birra",
    "verë",
    "vere",
    "koktej",
    "energjike",
  ];

  if (drinksWords.some((w) => cat.includes(w))) {
    return "drink";
  }
  return "food";
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
      offersSection.style.display = "none";
      if (drinksSection) drinksSection.style.display = "none";
      if (drinksTabsWrapper) drinksTabsWrapper.style.display = "none";
      if (foodTabsWrapper) foodTabsWrapper.style.display = "none";
      return;
    }

    const data = restaurantSnap.data();
    restaurantNameEl.textContent = data.restaurantName || "Unbenanntes Lokal";
    restaurantMetaEl.textContent = "Mirësevini në menynë digjitale";

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
      offersSection.style.display = "none";
      if (drinksSection) drinksSection.style.display = "none";
      if (drinksTabsWrapper) drinksTabsWrapper.style.display = "none";
      if (foodTabsWrapper) foodTabsWrapper.style.display = "none";
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
        };
      })
      .filter((item) => item.available);

    items = items.map((item) => ({
      ...item,
      type: inferTypeForItem(item),
    }));

    allMenuItems = items;
    drinksItems = allMenuItems.filter((i) => i.type === "drink");
    foodItems = allMenuItems.filter((i) => i.type === "food");

    renderDrinksTabs();
    renderDrinks();
    renderFoodCategories();
    renderMenu();

    await loadOffersForRestaurant(restaurantRef, data);
  } catch (err) {
    console.error(err);
    restaurantNameEl.textContent = "Fehler";
    restaurantMetaEl.textContent = err.message;
    menuListEl.innerHTML =
      "<p class='info'>Fehler beim Laden der Speisekarte.</p>";
    cartSection.style.display = "none";
    offersSection.style.display = "none";
    if (drinksSection) drinksSection.style.display = "none";
    if (drinksTabsWrapper) drinksTabsWrapper.style.display = "none";
    if (foodTabsWrapper) foodTabsWrapper.style.display = "none";
  }
}

/* =========================
   GETRÄNKE-TABS & -LISTE
   ========================= */

function getDrinkCategories() {
  const set = new Set();
  drinksItems.forEach((i) => {
    if (i.category) set.add(i.category);
  });
  return Array.from(set);
}

function renderDrinksTabs() {
  if (!drinksTabsWrapper || !drinksTabsEl) return;

  const cats = getDrinkCategories();

  if (!cats.length) {
    drinksTabsWrapper.style.display = "none";
    if (drinksSection) drinksSection.style.display = "none";
    drinksTabsEl.innerHTML = "";
    return;
  }

  drinksTabsWrapper.style.display = "block";
  if (drinksSection) drinksSection.style.display = "block";
  drinksTabsEl.innerHTML = "";

  if (!activeDrinksCategory || !cats.includes(activeDrinksCategory)) {
    activeDrinksCategory = cats[0];
  }

  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className =
      "category-tab" + (activeDrinksCategory === cat ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeDrinksCategory = cat;
      renderDrinksTabs();
      renderDrinks();
    });
    drinksTabsEl.appendChild(btn);
  });
}

function renderDrinks() {
  if (!drinksSection || !drinksListEl) return;

  drinksListEl.innerHTML = "";

  if (!drinksItems.length) {
    drinksSection.style.display = "none";
    if (drinksTabsWrapper) drinksTabsWrapper.style.display = "none";
    return;
  }

  drinksSection.style.display = "block";
  if (drinksTabsWrapper) drinksTabsWrapper.style.display = "block";

  let items = drinksItems;
  if (activeDrinksCategory) {
    items = drinksItems.filter((i) => i.category === activeDrinksCategory);
  }

  if (!items.length) {
    drinksListEl.innerHTML = "<p class='info'>Keine Getränke.</p>";
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "drink-item";

    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.loading = "lazy";
      img.className = "drink-image";
      div.appendChild(img);
    }

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
    div.appendChild(header);

    if (item.description && item.description.trim() !== "") {
      const descEl = document.createElement("div");
      descEl.className = "drink-desc";
      descEl.textContent = item.description;
      div.appendChild(descEl);
    }

    const actions = document.createElement("div");
    actions.className = "drink-actions";

    const minusBtn = document.createElement("button");
    minusBtn.className = "btn btn-ghost btn-small";
    minusBtn.textContent = "−";
    minusBtn.addEventListener("click", () => changeCart(item, -1));

    const plusBtn = document.createElement("button");
    plusBtn.className = "btn btn-primary btn-small";
    plusBtn.textContent = "Hinzufügen";
    plusBtn.addEventListener("click", () => changeCart(item, 1));

    actions.appendChild(minusBtn);
    actions.appendChild(plusBtn);
    div.appendChild(actions);

    drinksListEl.appendChild(div);
  });
}

/* =========================
   SPEISEKARTE-TABS & -LISTE
   ========================= */

function getFoodCategories() {
  const set = new Set();
  foodItems.forEach((i) => {
    if (i.category) set.add(i.category);
  });
  return Array.from(set);
}

function renderFoodCategories() {
  if (!foodCategoryTabsEl || !foodTabsWrapper) return;

  foodCategoryTabsEl.innerHTML = "";

  const cats = getFoodCategories();
  foodTabsWrapper.style.display = "block";

  const allBtn = document.createElement("button");
  allBtn.className =
    "category-tab" + (activeFoodCategory === "Alle" ? " active" : "");
  allBtn.textContent = "Alle";
  allBtn.addEventListener("click", () => {
    activeFoodCategory = "Alle";
    renderFoodCategories();
    renderMenu();
  });
  foodCategoryTabsEl.appendChild(allBtn);

  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.className =
      "category-tab" + (activeFoodCategory === cat ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      activeFoodCategory = cat;
      renderFoodCategories();
      renderMenu();
    });
    foodCategoryTabsEl.appendChild(btn);
  });
}

function renderMenu() {
  menuListEl.innerHTML = "";

  let items = foodItems;

  if (activeFoodCategory !== "Alle") {
    items = items.filter((i) => i.category === activeFoodCategory);
  }

  if (searchTerm) {
    const q = searchTerm;
    items = items.filter((i) => {
      const text = `${i.name} ${i.description} ${i.longDescription}`.toLowerCase();
      return text.includes(q);
    });
  }

  if (!items.length) {
    menuListEl.innerHTML = "<p class='info'>Keine Produkte.</p>";
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "menu-item";

    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.className = "menu-item-image";
      img.loading = "lazy";
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

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-dark";
    detailsBtn.textContent = "Detajet";
    detailsBtn.addEventListener("click", () => openProductDetail(item));

    const plusBtn = document.createElement("button");
    plusBtn.className = "btn btn-primary";
    plusBtn.textContent = "Hinzufügen";
    plusBtn.addEventListener("click", () => changeCart(item, 1));

    actions.appendChild(minusBtn);
    actions.appendChild(detailsBtn);
    actions.appendChild(plusBtn);
    div.appendChild(actions);

    menuListEl.appendChild(div);
  });
}

/* =========================
   PRODUKT-DETAIL DRAWER
   ========================= */

function openProductDetail(item) {
  currentDetailItem = item;
  currentDetailQty = 1;

  if (item.imageUrl) {
    detailImageEl.src = item.imageUrl;
    detailImageEl.style.display = "block";
  } else {
    detailImageEl.style.display = "none";
  }

  detailTitleEl.textContent = item.name;
  detailPriceEl.textContent = item.price.toFixed(2) + " €";

  const longText = item.longDescription || item.description || "";
  detailLongDescEl.textContent = longText;
  detailZutatenEl.textContent = item.description || "";

  detailQtyValueEl.textContent = currentDetailQty;

  productDetailOverlay.classList.add("drawer-overlay--visible");
  productDetailDrawer.classList.add("drawer--visible");
}

function closeProductDetail() {
  currentDetailItem = null;
  productDetailOverlay.classList.remove("drawer-overlay--visible");
  productDetailDrawer.classList.remove("drawer--visible");
}

/* =========================
   WARENKORB + CART DRAWER
   ========================= */

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

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  if (totalQty > 0) {
    cartBadgeEl.textContent = String(totalQty);
    cartBadgeEl.style.display = "flex";
    cartFab.classList.add("visible", "cart-fab--has-items");
    if (cartFabLabel) cartFabLabel.style.display = "block";
  } else {
    cartBadgeEl.style.display = "none";
    cartFab.classList.remove("visible", "cart-fab--has-items");
    if (cartFabLabel) cartFabLabel.style.display = "none";
  }
}

function renderCart() {
  if (!cart.length) {
    cartSection.style.display = "none";
    updateCartBadge();
    renderCartDrawer();
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
  updateCartBadge();
  renderCartDrawer();
}

function renderCartDrawer() {
  cartDrawerItemsEl.innerHTML = "";
  if (!cart.length) {
    cartDrawerItemsEl.innerHTML = "<p class='info'>Noch keine Artikel.</p>";
    cartDrawerTotalEl.textContent = "";
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.qty;
    const row = document.createElement("div");
    row.className = "cart-item-row";
    row.innerHTML = `
      <span>${item.qty}× ${item.name}</span>
      <span>${(item.price * item.qty).toFixed(2)} €</span>
    `;
    cartDrawerItemsEl.appendChild(row);
  });

  cartDrawerTotalEl.textContent = `Summe: ${total.toFixed(2)} €`;
}

function openCartDrawer() {
  if (!cart.length) return;
  renderCartDrawer();
  cartDrawerOverlay.classList.add("drawer-overlay--visible");
  cartDrawer.classList.add("drawer--visible");
}

function closeCartDrawer() {
  cartDrawerOverlay.classList.remove("drawer-overlay--visible");
  cartDrawer.classList.remove("drawer--visible");
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

/* =========================
   EVENTS
   ========================= */

// Cart inline
clearCartBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
});

sendOrderBtn.addEventListener("click", sendOrder);

// Suche (live) – nur für Speisekarte (Food)
searchInput.addEventListener("input", () => {
  searchTerm = (searchInput.value || "").trim().toLowerCase();
  renderMenu();
});

// Floating Cart Button → Drawer
cartFab.addEventListener("click", () => {
  openCartDrawer();
});

// Produkt-Detail Drawer Events
detailQtyMinusBtn.addEventListener("click", () => {
  if (currentDetailQty > 1) {
    currentDetailQty -= 1;
    detailQtyValueEl.textContent = currentDetailQty;
  }
});

detailQtyPlusBtn.addEventListener("click", () => {
  currentDetailQty += 1;
  detailQtyValueEl.textContent = currentDetailQty;
});

detailAddBtn.addEventListener("click", () => {
  if (!currentDetailItem) return;
  changeCart(currentDetailItem, currentDetailQty);
});

detailCloseBtn.addEventListener("click", closeProductDetail);
productDetailOverlay.addEventListener("click", closeProductDetail);

// Cart Drawer Events
cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
cartDrawerOverlay.addEventListener("click", closeCartDrawer);
cartDrawerClearBtn.addEventListener("click", () => {
  cart = [];
  renderCart();
  closeCartDrawer();
});
cartDrawerSendBtn.addEventListener("click", () => {
  closeCartDrawer();
  sendOrder();
});

// Initial load
loadRestaurantAndMenu();
renderCart(); // sorgt dafür, dass FAB am Anfang versteckt ist
