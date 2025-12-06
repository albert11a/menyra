// karte.js – Gäste-Ansicht mit Drinks, Speisekarte, Likes, globalem Warenkorb

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

const params = new URLSearchParams(window.location.search);
const restaurantId = params.get("r") || "shpija-e-vjetr";
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

// SUCHE & FLOATING CART
const searchInput = document.getElementById("searchInput");
const cartFab = document.getElementById("cartFab");
const cartFabLabel = document.getElementById("cartFabLabel");
const cartBadgeEl = document.getElementById("cartBadge");

// STATUS-ROW + ORDER-DETAILS
const orderToggleBtn = document.getElementById("orderToggleBtn");
const orderDetailsContainer = document.getElementById("orderDetailsContainer");
const orderDetailsCard = document.getElementById("orderDetailsCard");
const orderStatusBadge = document.getElementById("orderStatusBadge");
const orderDetailsContent = document.getElementById("orderDetailsContent");

const callWaiterBtn = document.getElementById("callWaiterBtn");

/* =========================
   LANGUAGE-UI REFERENZEN
   ========================= */

const langCard = document.getElementById("langCard");
const langButtons = document.querySelectorAll("[data-lang-btn]");
const statusOrderLabelEl = document.getElementById("statusOrderLabel");
const statusCallLabelEl = document.getElementById("statusCallLabel");
const langTitleEl = document.getElementById("langTitle");
const langHintEl = document.getElementById("langHint");

const LANGS = {
  sq: {
    label: "SQ",
    orderTitle: "Porosia juaj",
    orderBtnClosed: "Shiko porosinë +",
    orderBtnOpen: "Shiko porosinë -",
    callTitle: "Thirr kamarierin",
    callBtnIdle: "Thirr kamarierin",
    callBtnActive: "Kamarieri vjen",
    langTitle: "Gjuha",
    langHint: "Zgjidh gjuhën për porosi & kamarier.",
  },
  de: {
    label: "DE",
    orderTitle: "Deine Bestellung",
    orderBtnClosed: "Bestellung anzeigen +",
    orderBtnOpen: "Bestellung ausblenden -",
    callTitle: "Kellner rufen",
    callBtnIdle: "Kellner rufen",
    callBtnActive: "Kellner kommt",
    langTitle: "Sprache",
    langHint: "Sprache für Bestellung & Kellner.",
  },
  en: {
    label: "EN",
    orderTitle: "Your order",
    orderBtnClosed: "View order +",
    orderBtnOpen: "Hide order -",
    callTitle: "Call waiter",
    callBtnIdle: "Call waiter",
    callBtnActive: "Waiter on the way",
    langTitle: "Language",
    langHint: "Choose language for order & waiter.",
  },
  sr: {
    label: "SR",
    orderTitle: "Tvoja porudžbina",
    orderBtnClosed: "Prikaži porudžbinu +",
    orderBtnOpen: "Sakrij porudžbinu -",
    callTitle: "Pozovi konobara",
    callBtnIdle: "Pozovi konobara",
    callBtnActive: "Konobar dolazi",
    langTitle: "Jezik",
    langHint: "Izaberi jezik za porudžbinu i konobara.",
  },
};

function getLangStorageKey() {
  return `menyra_lang_${restaurantId}`;
}

function loadLanguageFromStorage() {
  try {
    const stored = localStorage.getItem(getLangStorageKey());
    if (stored && LANGS[stored]) return stored;
  } catch {
    // ignore
  }
  return "sq"; // Standard: Albanisch
}

function saveLanguageToStorage(lang) {
  try {
    localStorage.setItem(getLangStorageKey(), lang);
  } catch {
    // ignore
  }
}

let currentLang = loadLanguageFromStorage();

/* =========================
   SPRACHE AUF UI ANWENDEN
   ========================= */

function applyLanguageToUI() {
  const cfg = LANGS[currentLang] || LANGS.sq;

  // Language-Card Überschrift / Hint
  if (langTitleEl) langTitleEl.textContent = cfg.langTitle;
  if (langHintEl) langHintEl.textContent = cfg.langHint;

  // Pills aktiv setzen
  if (langButtons?.length) {
    langButtons.forEach((btn) => {
      const code = btn.dataset.lang;
      if (code === currentLang) {
        btn.classList.add("lang-pill--active");
      } else {
        btn.classList.remove("lang-pill--active");
      }
    });
  }

  // Porosia Label
  if (statusOrderLabelEl) {
    statusOrderLabelEl.textContent = cfg.orderTitle;
  }

  // Button-Text Porosia je nach offen/zu
  if (orderToggleBtn) {
    orderToggleBtn.textContent = orderDetailsOpen
      ? cfg.orderBtnOpen
      : cfg.orderBtnClosed;
  }

  // Kamarieri Label
  if (statusCallLabelEl) {
    statusCallLabelEl.textContent = cfg.callTitle;
  }

  // Kamarieri Button je nach aktiv
  if (callWaiterBtn) {
    const hasOpen = callWaiterBtn.classList.contains(
      "call-waiter-btn--active"
    );
    callWaiterBtn.textContent = hasOpen
      ? cfg.callBtnActive
      : cfg.callBtnIdle;
  }
}

/* =========================
   STATE
   ========================= */

let allMenuItems = [];
let drinksItems = [];
let foodItems = [];

let activeFoodCategory = "Alle";
let activeDrinksCategory = null;
let searchTerm = "";
let cart = [];

// Offers Slider State
let offersSlides = [];
let offersCurrentIndex = 0;
let offersTimer = null;

// Order-/Call-State
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
        : { id: "offer:" + offer.id, name: title, price: price || 0 };

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
      menuListEl.innerHTML = "<p class='info'>Bitte Personal informieren.</p>";
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
          likeCount: d.likeCount || 0,
          commentCount: d.commentCount || 0,
          ratingCount: d.ratingCount || 0,
          ratingSum: d.ratingSum || 0,
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
    const card = document.createElement("div");
    card.className = "drink-item";
    card.dataset.itemId = item.id;

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

    if (item.imageUrl) {
      const img = document.createElement("img");
      img.src = item.imageUrl;
      img.alt = item.name;
      img.loading = "lazy";
      img.className = "drink-image";
      card.appendChild(img);
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
    card.appendChild(header);

    if (item.description && item.description.trim() !== "") {
      const descEl = document.createElement("div");
      descEl.className = "drink-desc";
      descEl.textContent = item.description;
      card.appendChild(descEl);
    }

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
    const addSpan = document.createElement("span");
    addSpan.textContent = "Wähle";
    addBtn.appendChild(addSpan);

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
   SPEISEKARTE
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

    const socialRow = document.createElement("div");
    socialRow.className = "menu-item-social";

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className =
      "social-btn social-btn-like" +
      (isItemLiked(item.id) ? " social-btn-like--active" : "");
    likeBtn.innerHTML = `
      <span class="social-icon">❤️</span>
      <span class="social-count">${item.likeCount || 0}</span>
    `;
    likeBtn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await toggleItemLike(item);
    });

    const commentBtn = document.createElement("button");
    commentBtn.type = "button";
    commentBtn.className = "social-btn social-btn-comment";
    commentBtn.innerHTML = `
      <span class="social-icon">💬</span>
      <span class="social-count">${item.commentCount || 0}</span>
    `;
    commentBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const url = new URL(window.location.href);
      url.pathname = "detajet.html";
      url.searchParams.set("r", restaurantId);
      url.searchParams.set("t", tableId);
      url.searchParams.set("item", item.id);
      window.location.href = url.toString();
    });

    socialRow.appendChild(likeBtn);
    socialRow.appendChild(commentBtn);
    div.appendChild(socialRow);

    const actions = document.createElement("div");
    actions.className = "menu-item-actions";

    const detailsBtn = document.createElement("button");
    detailsBtn.className = "btn btn-dark";
    detailsBtn.textContent = "Detajet";
    detailsBtn.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.pathname = "detajet.html";
      url.searchParams.set("r", restaurantId);
      url.searchParams.set("t", tableId);
      url.searchParams.set("item", item.id);
      window.location.href = url.toString();
    });

    const plusBtn = document.createElement("button");
    plusBtn.className = "btn btn-primary";
    plusBtn.textContent = "Hinzufügen";
    plusBtn.addEventListener("click", () => changeCart(item, 1));

    actions.appendChild(detailsBtn);
    actions.appendChild(plusBtn);
    div.appendChild(actions);

    menuListEl.appendChild(div);
  });
}

/* =========================
   LIKES Firestore-Update
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
    likeWrapEl.classList.remove("is-animating");
    void likeWrapEl.offsetWidth;
    likeWrapEl.classList.add("is-animating");

    if (likedAfter) likeWrapEl.classList.add("is-liked");
    else likeWrapEl.classList.remove("is-liked");

    const countEl = likeWrapEl.querySelector(".like-count");
    if (countEl) countEl.textContent = String(item.likeCount || 0);

    setTimeout(() => likeWrapEl.classList.remove("is-animating"), 280);
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

  renderMenu();
}

/* =========================
   WARENKORB (nur FAB + Badge)
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
  updateCartBadge();
  saveCartToStorage();
}

function changeCart(item, delta) {
  const index = cart.findIndex((c) => c.id === item.id);
  if (index === -1 && delta > 0) {
    cart.push({ id: item.id, name: item.name, price: item.price, qty: delta });
  } else if (index >= 0) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) cart.splice(index, 1);
  }
  renderCart();
  renderDrinks();
}

/* =========================
   GUEST: ORDER OVERVIEW (Shiko porosinë)
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
  if (!orderStatusBadge || !orderDetailsContent) return;
  orderStatusBadge.textContent = "S'ka porosi";
  orderStatusBadge.className =
    "order-status-badge order-status-badge--empty";
  orderDetailsContent.textContent = "Ende nuk keni porositur.";
}

function renderLatestOrder(latest) {
  if (!orderStatusBadge || !orderDetailsContent) return;

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

  const html = `
    <div class="order-items-list">
      ${lines}
    </div>
    <div class="order-summary-row">
      <span>Totali</span>
      <span>${total.toFixed(2)} €</span>
    </div>
  `;

  orderDetailsContent.innerHTML = html;
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
          found = {
            id: docSnap.id,
            ...data,
          };
        }
      });

      if (!found) {
        renderOrderEmpty();
      } else {
        renderLatestOrder(found);
      }
    },
    (err) => {
      console.error("[KARTE] OrderListener Fehler:", err);
      renderOrderEmpty();
    }
  );
}

function openOrderDetails() {
  orderDetailsOpen = true;
  if (!orderToggleBtn || !orderDetailsContainer || !orderDetailsCard) return;

  orderToggleBtn.classList.add("order-toggle-btn--active");

  orderDetailsContainer.style.display = "block";
  requestAnimationFrame(() => {
    orderDetailsCard.classList.add("order-details-card--open");
  });

  // Text in gewählter Sprache aktualisieren
  applyLanguageToUI();
}

function closeOrderDetails() {
  orderDetailsOpen = false;
  if (!orderToggleBtn || !orderDetailsContainer || !orderDetailsCard) return;

  orderToggleBtn.classList.remove("order-toggle-btn--active");
  orderDetailsCard.classList.remove("order-details-card--open");
  setTimeout(() => {
    if (!orderDetailsOpen) {
      orderDetailsContainer.style.display = "none";
    }
  }, 220);

  // Text in gewählter Sprache aktualisieren
  applyLanguageToUI();
}

/* =========================
   GUEST: THIRR KAMARIERIN
   ========================= */

function updateWaiterCallUI(hasOpen) {
  if (!callWaiterBtn) return;

  if (hasOpen) {
    callWaiterBtn.classList.add("call-waiter-btn--active");
  } else {
    callWaiterBtn.classList.remove("call-waiter-btn--active");
  }

  // Text je nach Sprache setzen
  applyLanguageToUI();
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
      console.error("[KARTE] WaiterCallListener Fehler:", err);
    }
  );
}

async function handleCallWaiter() {
  if (!callWaiterBtn) return;

  callWaiterBtn.disabled = true;

  try {
    const callsCol = collection(
      db,
      "restaurants",
      restaurantId,
      "calls"
    );

    // Check, ob schon eine offene Thirrje existiert
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

    // Direkt UI umstellen, Listener hält das dann aktuell
    updateWaiterCallUI(true);
  } catch (err) {
    console.error("[KARTE] Fehler bei Thirr kamarierin:", err);
    alert("Thirrja nuk u dërgua, provo përsëri.");
  } finally {
    callWaiterBtn.disabled = false;
  }
}

/* =========================
   EVENTS
   ========================= */

if (searchInput) {
  searchInput.addEventListener("input", () => {
    searchTerm = (searchInput.value || "").trim().toLowerCase();
    renderMenu();
  });
}

if (cartFab) {
  cartFab.addEventListener("click", () => {
    if (!cart.length) return;
    const url = new URL(window.location.href);
    url.pathname = "porosia.html";
    url.searchParams.set("r", restaurantId);
    url.searchParams.set("t", tableId);
    window.location.href = url.toString();
  });
}

window.addEventListener("pageshow", () => {
  cart = loadCartFromStorage();
  renderCart();
});

if (orderToggleBtn) {
  orderToggleBtn.addEventListener("click", () => {
    if (orderDetailsOpen) {
      closeOrderDetails();
    } else {
      openOrderDetails();
    }
  });
}

if (callWaiterBtn) {
  callWaiterBtn.addEventListener("click", () => {
    handleCallWaiter();
  });
}

// LANGUAGE EVENTS
if (langButtons?.length) {
  langButtons.forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const code = btn.dataset.lang;
      if (!code || !LANGS[code]) return;
      currentLang = code;
      saveLanguageToStorage(code);
      applyLanguageToUI();
    });
  });
}

/* =========================
   INIT
   ========================= */

cart = loadCartFromStorage();
renderCart();
loadRestaurantAndMenu();
startLatestOrderListener();
startWaiterCallListener();
applyLanguageToUI();
