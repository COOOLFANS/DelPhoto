const TOTAL_IMAGES = 60;
const ROUND_SIZE = 20;
const IMAGE_BASE_URL = "https://source.unsplash.com/random/600x800/?animal&sig=";

const cardStack = document.querySelector("#card-stack");
const actionLogList = document.querySelector("#action-log-list");
const favoriteGrid = document.querySelector("#favorite-grid");
const favoritesEmpty = document.querySelector("#favorites-empty");
const roundNumberEl = document.querySelector("#round-number");
const remainingInRoundEl = document.querySelector("#remaining-in-round");
const deletedCountEl = document.querySelector("#deleted-count");
const keptCountEl = document.querySelector("#kept-count");
const favoriteCountEl = document.querySelector("#favorite-count");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayMessage = document.querySelector("#overlay-message");
const overlayButton = document.querySelector("#overlay-button");

const cardTemplate = document.querySelector("#photo-card-template");

let shuffledImages = [];
let currentRound = [];
let roundNumber = 0;
const actionHistory = [];
const results = {
  delete: [],
  keep: [],
  favorite: [],
};

function generateImageList() {
  const urls = Array.from({ length: TOTAL_IMAGES }, (_, index) => `${IMAGE_BASE_URL}${index + 1}`);
  return shuffle(urls);
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startNextRound() {
  if (shuffledImages.length === 0 && currentRound.length === 0) {
    overlayTitle.textContent = "全部完成";
    overlayMessage.textContent = `共处理 ${TOTAL_IMAGES} 张照片，删除 ${results.delete.length} 张，保留 ${results.keep.length} 张，收藏 ${results.favorite.length} 张。`;
    overlayButton.hidden = false;
    overlayButton.textContent = "重新开始";
    overlayButton.dataset.action = "restart";
    overlay.removeAttribute("hidden");
    return;
  }

  roundNumber += 1;
  roundNumberEl.textContent = String(roundNumber);

  const batch = [];
  while (batch.length < ROUND_SIZE && shuffledImages.length > 0) {
    batch.push(shuffledImages.pop());
  }

  if (batch.length === 0) {
    // 所有图片都处理完
    startNextRound();
    return;
  }

  currentRound = batch.map((url, idx) => ({
    id: `round-${roundNumber}-card-${idx}-${Math.random().toString(16).slice(2, 8)}`,
    url,
  }));

  remainingInRoundEl.textContent = String(currentRound.length);
  overlay.setAttribute("hidden", "");
  overlayButton.hidden = false;
  overlayButton.textContent = "开始下一轮";
  overlayButton.dataset.action = "next";

  renderRoundCards();
}

function renderRoundCards() {
  cardStack.innerHTML = "";
  currentRound.forEach((cardInfo, idx) => {
    const cardNode = cardTemplate.content.firstElementChild.cloneNode(true);
    const img = cardNode.querySelector("img");
    const indicator = cardNode.querySelector(".action-indicator");

    img.src = cardInfo.url;
    img.loading = "lazy";
    cardNode.dataset.cardId = cardInfo.id;

    cardNode.style.zIndex = String(100 - idx);
    cardNode.style.transform = `translateY(-${idx * 6}px)`;
    cardNode.style.opacity = `${1 - idx * 0.02}`;

    addDragHandlers(cardNode, indicator, cardInfo);

    cardStack.append(cardNode);
  });
}

function addDragHandlers(cardNode, indicator, cardInfo) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;

  function updateIndicator(action) {
    indicator.textContent = "";
    cardNode.classList.remove("show-delete", "show-keep", "show-favorite");
    if (!action) return;
    const classes = {
      delete: "show-delete",
      keep: "show-keep",
      favorite: "show-favorite",
    };
    const labels = {
      delete: "删除",
      keep: "保留",
      favorite: "收藏",
    };
    indicator.textContent = labels[action];
    cardNode.classList.add(classes[action]);
  }

  function onMouseMove(event) {
    if (!isDragging) return;
    currentX = event.clientX - startX;
    currentY = event.clientY - startY;

    cardNode.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${currentX * 0.05}deg)`;

    let action = null;
    if (currentX <= -120) {
      action = "delete";
    } else if (currentX >= 120) {
      action = "keep";
    } else if (currentY >= 140) {
      action = "favorite";
    }
    updateIndicator(action);
  }

  function onMouseUp() {
    if (!isDragging) return;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    cardNode.classList.remove("dragging");

    const action = determineAction(currentX, currentY);
    if (action) {
      completeAction(cardNode, cardInfo, action, currentX, currentY);
    } else {
      resetCardPosition(cardNode, indicator);
    }
    isDragging = false;
  }

  cardNode.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    currentX = 0;
    currentY = 0;
    cardNode.classList.add("dragging");
    cardNode.style.transition = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

function determineAction(dx, dy) {
  if (dx <= -120) return "delete";
  if (dx >= 120) return "keep";
  if (dy >= 140) return "favorite";
  return null;
}

function resetCardPosition(cardNode, indicator) {
  cardNode.style.transition = "transform 0.3s ease";
  cardNode.style.transform = "translate(0, 0)";
  indicator.textContent = "";
  cardNode.classList.remove("show-delete", "show-keep", "show-favorite");
}

function completeAction(cardNode, cardInfo, action, dx, dy) {
  cardNode.style.transition = "transform 0.4s ease, opacity 0.4s ease";
  if (action === "delete") {
    cardNode.style.transform = "translate(-600px, 0) rotate(-24deg)";
  } else if (action === "keep") {
    cardNode.style.transform = "translate(600px, 0) rotate(24deg)";
  } else {
    cardNode.style.transform = "translate(0, 650px) rotate(0deg)";
  }
  cardNode.style.opacity = "0";

  setTimeout(() => {
    cardNode.remove();
    recordAction(cardInfo, action);
    moveToNextCard(cardInfo);
  }, 300);
}

function recordAction(cardInfo, action) {
  const timestamp = new Date();
  const entry = {
    ...cardInfo,
    action,
    timestamp,
  };
  actionHistory.unshift(entry);
  if (actionHistory.length > 12) {
    actionHistory.length = 12;
  }
  results[action].push(entry);
  updateActionLog();
  updateStats();
  if (action === "favorite") {
    updateFavorites(entry.url);
  }
}

function updateActionLog() {
  actionLogList.innerHTML = "";
  const fragments = document.createDocumentFragment();
  actionHistory.forEach((item) => {
    const li = document.createElement("li");
    const actionLabel = {
      delete: "删除",
      keep: "保留",
      favorite: "收藏",
    }[item.action];
    li.textContent = `${formatTime(item.timestamp)} · ${actionLabel}`;
    fragments.append(li);
  });
  actionLogList.append(fragments);
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function updateStats() {
  deletedCountEl.textContent = String(results.delete.length);
  keptCountEl.textContent = String(results.keep.length);
  favoriteCountEl.textContent = String(results.favorite.length);
  remainingInRoundEl.textContent = String(currentRound.length);
}

function updateFavorites(url) {
  favoritesEmpty.hidden = true;
  const img = document.createElement("img");
  img.src = url;
  img.alt = "收藏的动物照片";
  img.loading = "lazy";
  favoriteGrid.append(img);
}

function moveToNextCard(cardInfo) {
  currentRound = currentRound.filter((item) => item.id !== cardInfo.id);
  remainingInRoundEl.textContent = String(currentRound.length);

  if (currentRound.length === 0) {
    showRoundSummary();
  }
}

function showRoundSummary() {
  const deletedThisRound = results.delete.filter((item) => item.id.includes(`round-${roundNumber}-`)).length;
  const keptThisRound = results.keep.filter((item) => item.id.includes(`round-${roundNumber}-`)).length;
  const favoriteThisRound = results.favorite.filter((item) => item.id.includes(`round-${roundNumber}-`)).length;

  overlayTitle.textContent = `第 ${roundNumber} 轮完成`;
  overlayMessage.textContent = `删除 ${deletedThisRound} 张，保留 ${keptThisRound} 张，收藏 ${favoriteThisRound} 张。`;
  overlayButton.hidden = false;
  overlayButton.textContent = "开始下一轮";
  overlayButton.dataset.action = "next";
  overlay.removeAttribute("hidden");
}

overlayButton.addEventListener("click", () => {
  const action = overlayButton.dataset.action;
  overlay.setAttribute("hidden", "");
  if (action === "restart") {
    resetAppState();
  }
  startNextRound();
});

document.addEventListener("DOMContentLoaded", () => {
  shuffledImages = generateImageList();
  startNextRound();
});

function resetAppState() {
  shuffledImages = generateImageList();
  currentRound = [];
  roundNumber = 0;
  actionHistory.length = 0;
  results.delete.length = 0;
  results.keep.length = 0;
  results.favorite.length = 0;
  roundNumberEl.textContent = "0";
  remainingInRoundEl.textContent = "0";
  actionLogList.innerHTML = "";
  favoriteGrid.innerHTML = "";
  favoritesEmpty.hidden = false;
  updateStats();
}

