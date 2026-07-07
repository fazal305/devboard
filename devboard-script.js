const storageKey = "devboard-state";
const defaultColumns = ["TO DO", "IN PROGRESS", "REVIEW", "DONE"];
const cardColors = ["#00f5ff", "#bf5fff", "#39ff88", "#ffcc4d", "#ff4d6d", "#4d7cff"];

const boardList = document.getElementById("boardList");
const activeBoardTitle = document.getElementById("activeBoardTitle");
const boardContainer = document.getElementById("boardContainer");
const statsBar = document.getElementById("statsBar");
const newBoardInput = document.getElementById("newBoardInput");
const newBoardBtn = document.getElementById("newBoardBtn");
const searchInput = document.getElementById("searchInput");
const clearDoneBtn = document.getElementById("clearDoneBtn");
const addColumnBtn = document.getElementById("addColumnBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");

let appState = {
  activeBoard: "",
  theme: "dark",
  boards: []
};

let openForm = {
  columnId: null,
  cardId: null
};

let searchQuery = "";
let expandedCards = [];

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(appState));
}

function createDefaultColumns() {
  return defaultColumns.map(function (columnTitle) {
    return {
      id: generateId("column"),
      title: columnTitle,
      cards: []
    };
  });
}

function createDefaultState() {
  const defaultBoardId = generateId("board");
  const starterColumns = createDefaultColumns();

  starterColumns[0].cards.push({
    id: generateId("card"),
    title: "Polish portfolio README",
    description: "Improve project overview, features, tech stack, and run instructions.",
    priority: "HIGH",
    dueDate: "",
    color: "#bf5fff",
    createdAt: Date.now()
  });

  starterColumns[1].cards.push({
    id: generateId("card"),
    title: "Test drag and drop",
    description: "Move a card between columns and confirm the saved state updates.",
    priority: "MEDIUM",
    dueDate: "",
    color: "#00f5ff",
    createdAt: Date.now()
  });

  return {
    activeBoard: defaultBoardId,
    theme: "dark",
    boards: [
      {
        id: defaultBoardId,
        name: "Portfolio Polish",
        columns: starterColumns
      }
    ]
  };
}

function loadState() {
  const savedState = localStorage.getItem(storageKey);

  if (!savedState) {
    appState = createDefaultState();
    saveState();
    return;
  }

  try {
    appState = JSON.parse(savedState);

    if (!Array.isArray(appState.boards) || appState.boards.length === 0) {
      throw new Error("Saved state is missing boards.");
    }
  } catch (error) {
    appState = createDefaultState();
    saveState();
  }
}

function getActiveBoard() {
  return appState.boards.find(function (board) {
    return board.id === appState.activeBoard;
  });
}

function findColumnById(columnId) {
  const activeBoard = getActiveBoard();
  return activeBoard ? activeBoard.columns.find(function (column) {
    return column.id === columnId;
  }) : null;
}

function findCardById(cardId) {
  const activeBoard = getActiveBoard();

  if (!activeBoard) {
    return null;
  }

  for (const column of activeBoard.columns) {
    const card = column.cards.find(function (cardItem) {
      return cardItem.id === cardId;
    });

    if (card) {
      return { card, column };
    }
  }

  return null;
}

function applyTheme() {
  document.documentElement.classList.toggle("light-theme", appState.theme === "light");
}

function toggleTheme() {
  appState.theme = appState.theme === "dark" ? "light" : "dark";
  saveState();
  applyTheme();
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);

  if (className) {
    element.className = className;
  }

  if (textContent !== undefined) {
    element.textContent = textContent;
  }

  return element;
}

function renderSidebar() {
  const activeBoard = getActiveBoard();
  boardList.innerHTML = "";

  appState.boards.forEach(function (board) {
    const boardItem = createElement("button", board.id === appState.activeBoard ? "board-item active" : "board-item");
    boardItem.type = "button";

    const boardName = createElement("span", "board-name", board.name);
    const deleteButton = createElement("span", "delete-board-btn", "x");
    deleteButton.setAttribute("role", "button");
    deleteButton.setAttribute("aria-label", `Delete ${board.name}`);

    boardItem.append(boardName, deleteButton);
    boardItem.addEventListener("click", function () {
      switchBoard(board.id);
    });

    deleteButton.addEventListener("click", function (event) {
      event.stopPropagation();
      deleteBoard(board.id);
    });

    boardList.appendChild(boardItem);
  });

  activeBoardTitle.textContent = activeBoard ? activeBoard.name : "No board selected";
}

function renderBoard() {
  const activeBoard = getActiveBoard();
  boardContainer.innerHTML = "";

  if (!activeBoard) {
    boardContainer.appendChild(createElement("p", "empty-column-text", "No active board found."));
    return;
  }

  activeBoard.columns.forEach(function (column) {
    boardContainer.appendChild(renderColumn(column));
  });

  renderStats();
}

function renderColumn(column) {
  const columnElement = createElement("div", "board-column");
  columnElement.dataset.columnId = column.id;

  const header = createElement("div", "column-header");
  const titleWrap = createElement("div", "column-title-wrap");
  const title = createElement("h3", "column-title", column.title);
  const count = createElement("span", "column-count", `${column.cards.length} cards`);
  const deleteButton = createElement("button", "delete-column-btn", "x");
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${column.title}`);

  titleWrap.append(title, count);
  header.append(titleWrap, deleteButton);

  const cardList = createElement("div", "card-list");

  if (column.cards.length === 0 && openForm.columnId !== column.id) {
    cardList.appendChild(createElement("div", "empty-column-text", "+ Drop cards here"));
  }

  column.cards.forEach(function (card) {
    cardList.appendChild(renderCard(card, column.id));
  });

  if (openForm.columnId === column.id && openForm.cardId === null) {
    cardList.appendChild(createCardForm(column.id));
  }

  const addCardButton = createElement("button", "add-card-btn", "+ Add Card");
  addCardButton.type = "button";

  columnElement.append(header, cardList, addCardButton);

  columnElement.addEventListener("dragover", function (event) {
    event.preventDefault();
  });

  columnElement.addEventListener("dragenter", function () {
    columnElement.classList.add("drag-over");
  });

  columnElement.addEventListener("dragleave", function (event) {
    if (!columnElement.contains(event.relatedTarget)) {
      columnElement.classList.remove("drag-over");
    }
  });

  columnElement.addEventListener("drop", function (event) {
    onDrop(column.id, event);
    columnElement.classList.remove("drag-over");
  });

  deleteButton.addEventListener("click", function () {
    deleteColumn(column.id);
  });

  addCardButton.addEventListener("click", function () {
    createCard(column.id);
  });

  return columnElement;
}

function renderCard(card, columnId) {
  const cleanSearchQuery = searchQuery.trim().toLowerCase();
  const titleMatchesSearch = card.title.toLowerCase().includes(cleanSearchQuery);
  const isExpanded = expandedCards.includes(card.id);
  const priorityClass = `priority-${card.priority.toLowerCase()}`;
  const cardElement = createElement("article", cleanSearchQuery && !titleMatchesSearch ? "dev-card search-dimmed" : "dev-card");

  cardElement.draggable = true;
  cardElement.dataset.cardId = card.id;

  const colorBar = createElement("div", "card-color-bar");
  colorBar.style.background = card.color;

  const topRow = createElement("div", "card-top-row");
  const priorityBadge = createElement("span", `priority-badge ${priorityClass}`, card.priority);
  const actions = createElement("div", "card-actions");
  const editButton = createElement("button", "card-action-btn edit-card-btn", "Edit");
  const deleteButton = createElement("button", "card-action-btn card-delete-btn", "x");
  editButton.type = "button";
  deleteButton.type = "button";
  actions.append(editButton, deleteButton);
  topRow.append(priorityBadge, actions);

  const title = createElement("h4", "card-title", card.title);
  const description = card.description ? createElement("p", isExpanded ? "card-description" : "card-description hidden", card.description) : null;
  const dueDate = card.dueDate ? createElement("span", "card-due-date", `Due: ${card.dueDate}`) : null;

  cardElement.append(colorBar, topRow, title);

  if (description) {
    cardElement.appendChild(description);
  }

  if (dueDate) {
    cardElement.appendChild(dueDate);
  }

  cardElement.addEventListener("dragstart", function (event) {
    event.dataTransfer.setData("cardId", card.id);
    event.dataTransfer.setData("sourceColumnId", columnId);
    cardElement.classList.add("dragging");
  });

  cardElement.addEventListener("dragend", function () {
    cardElement.classList.remove("dragging");
  });

  title.addEventListener("click", function () {
    toggleCardExpand(card.id);
  });

  editButton.addEventListener("click", function () {
    editCard(card.id);
  });

  deleteButton.addEventListener("click", function () {
    deleteCard(card.id, columnId);
  });

  if (openForm.cardId === card.id) {
    cardElement.appendChild(createCardForm(columnId, card));
  }

  return cardElement;
}

function createCardForm(columnId, existingCard) {
  const formElement = createElement("form", "card-form");
  const selectedColor = existingCard ? existingCard.color : cardColors[0];
  let chosenColor = selectedColor;

  const titleInput = createElement("input", "form-title");
  titleInput.type = "text";
  titleInput.placeholder = "Card title";
  titleInput.required = true;
  titleInput.value = existingCard ? existingCard.title : "";

  const descriptionInput = createElement("textarea", "form-description");
  descriptionInput.placeholder = "Card description";
  descriptionInput.value = existingCard ? existingCard.description : "";

  const priorityInput = createElement("select", "form-priority");
  ["LOW", "MEDIUM", "HIGH"].forEach(function (priority) {
    const option = createElement("option", "", priority);
    option.value = priority;
    option.selected = existingCard ? existingCard.priority === priority : priority === "MEDIUM";
    priorityInput.appendChild(option);
  });

  const dueDateInput = createElement("input", "form-due-date");
  dueDateInput.type = "date";
  dueDateInput.value = existingCard ? existingCard.dueDate : "";

  const colorOptions = createElement("div", "color-options");
  cardColors.forEach(function (color) {
    const colorButton = createElement("button", color === selectedColor ? "color-option active" : "color-option");
    colorButton.type = "button";
    colorButton.dataset.color = color;
    colorButton.style.background = color;
    colorButton.setAttribute("aria-label", `Choose ${color}`);

    colorButton.addEventListener("click", function () {
      colorOptions.querySelectorAll(".color-option").forEach(function (button) {
        button.classList.remove("active");
      });

      colorButton.classList.add("active");
      chosenColor = color;
    });

    colorOptions.appendChild(colorButton);
  });

  const actions = createElement("div", "form-actions");
  const saveButton = createElement("button", "form-save-btn", existingCard ? "Save Changes" : "Create Card");
  const cancelButton = createElement("button", "form-cancel-btn", "Cancel");
  saveButton.type = "submit";
  cancelButton.type = "button";
  actions.append(saveButton, cancelButton);

  formElement.append(titleInput, descriptionInput, priorityInput, dueDateInput, colorOptions, actions);

  formElement.addEventListener("submit", function (event) {
    event.preventDefault();

    const cardData = {
      title: titleInput.value,
      description: descriptionInput.value,
      priority: priorityInput.value,
      dueDate: dueDateInput.value,
      color: chosenColor
    };

    if (existingCard) {
      updateCard(existingCard.id, cardData);
    } else {
      saveCard(columnId, cardData);
    }
  });

  cancelButton.addEventListener("click", closeOpenForm);

  window.setTimeout(function () {
    titleInput.focus();
  }, 0);

  return formElement;
}

function toggleCardExpand(cardId) {
  expandedCards = expandedCards.includes(cardId)
    ? expandedCards.filter(function (id) { return id !== cardId; })
    : expandedCards.concat(cardId);

  renderBoard();
}

function onDrop(targetColumnId, event) {
  event.preventDefault();

  const cardId = event.dataTransfer.getData("cardId");
  const sourceColumnId = event.dataTransfer.getData("sourceColumnId");

  if (!cardId || !sourceColumnId || sourceColumnId === targetColumnId) {
    return;
  }

  const sourceColumn = findColumnById(sourceColumnId);
  const targetColumn = findColumnById(targetColumnId);

  if (!sourceColumn || !targetColumn) {
    return;
  }

  const cardToMove = sourceColumn.cards.find(function (card) {
    return card.id === cardId;
  });

  if (!cardToMove) {
    return;
  }

  sourceColumn.cards = sourceColumn.cards.filter(function (card) {
    return card.id !== cardId;
  });

  targetColumn.cards.push(cardToMove);
  saveState();
  renderBoard();
}

function createCard(columnId) {
  openForm = { columnId, cardId: null };
  renderBoard();
}

function closeOpenForm() {
  openForm = { columnId: null, cardId: null };
  renderBoard();
}

function saveCard(columnId, cardData) {
  const targetColumn = findColumnById(columnId);
  const cleanTitle = cardData.title.trim();

  if (!targetColumn || cleanTitle === "") {
    alert("Card title is required.");
    return;
  }

  targetColumn.cards.push({
    id: generateId("card"),
    title: cleanTitle,
    description: cardData.description.trim(),
    priority: cardData.priority,
    dueDate: cardData.dueDate,
    color: cardData.color,
    createdAt: Date.now()
  });

  openForm = { columnId: null, cardId: null };
  saveState();
  renderBoard();
}

function editCard(cardId) {
  const foundCard = findCardById(cardId);

  if (!foundCard) {
    return;
  }

  openForm = { columnId: foundCard.column.id, cardId };
  renderBoard();
}

function updateCard(cardId, cardData) {
  const foundCard = findCardById(cardId);
  const cleanTitle = cardData.title.trim();

  if (!foundCard || cleanTitle === "") {
    alert("Card title is required.");
    return;
  }

  foundCard.card.title = cleanTitle;
  foundCard.card.description = cardData.description.trim();
  foundCard.card.priority = cardData.priority;
  foundCard.card.dueDate = cardData.dueDate;
  foundCard.card.color = cardData.color;

  openForm = { columnId: null, cardId: null };
  saveState();
  renderBoard();
}

function deleteCard(cardId, columnId) {
  const targetColumn = findColumnById(columnId);

  if (!targetColumn || !confirm("Delete this card?")) {
    return;
  }

  targetColumn.cards = targetColumn.cards.filter(function (card) {
    return card.id !== cardId;
  });
  expandedCards = expandedCards.filter(function (id) {
    return id !== cardId;
  });

  saveState();
  renderBoard();
}

function addColumn() {
  const activeBoard = getActiveBoard();
  const columnName = prompt("Enter column name:");

  if (!activeBoard || !columnName || columnName.trim() === "") {
    return;
  }

  activeBoard.columns.push({
    id: generateId("column"),
    title: columnName.trim().toUpperCase(),
    cards: []
  });

  saveState();
  renderBoard();
}

function deleteColumn(columnId) {
  const activeBoard = getActiveBoard();

  if (!activeBoard || !confirm("Delete this column?")) {
    return;
  }

  activeBoard.columns = activeBoard.columns.filter(function (column) {
    return column.id !== columnId;
  });

  saveState();
  renderBoard();
}

function renderStats() {
  const activeBoard = getActiveBoard();
  statsBar.innerHTML = "";

  if (!activeBoard) {
    return;
  }

  let totalCards = 0;

  activeBoard.columns.forEach(function (column) {
    totalCards += column.cards.length;
  });

  statsBar.appendChild(createStatPill("TOTAL", totalCards));

  activeBoard.columns.forEach(function (column) {
    statsBar.appendChild(createStatPill(column.title, column.cards.length));
  });

  window.setTimeout(function () {
    statsBar.querySelectorAll(".stat-pill").forEach(function (pill) {
      pill.classList.remove("pop");
    });
  }, 220);
}

function createStatPill(label, value) {
  const pill = createElement("span", "stat-pill pop");
  const strong = createElement("strong", "", String(value));
  pill.append(document.createTextNode(`${label}: `), strong);
  return pill;
}

function clearDoneCards() {
  const activeBoard = getActiveBoard();

  if (!activeBoard) {
    return;
  }

  const doneColumn = activeBoard.columns.find(function (column) {
    return column.title.toUpperCase() === "DONE";
  });

  if (!doneColumn) {
    alert("No DONE column found.");
    return;
  }

  if (doneColumn.cards.length === 0) {
    alert("DONE is already empty.");
    return;
  }

  if (!confirm("Clear all cards from DONE?")) {
    return;
  }

  doneColumn.cards = [];
  saveState();
  renderBoard();
}

function createBoard(name) {
  const cleanName = name.trim();

  if (cleanName === "") {
    alert("Please enter a board name.");
    return;
  }

  const newBoard = {
    id: generateId("board"),
    name: cleanName,
    columns: createDefaultColumns()
  };

  appState.boards.push(newBoard);
  appState.activeBoard = newBoard.id;
  searchQuery = "";
  searchInput.value = "";
  saveState();
  renderSidebar();
  renderBoard();
}

function switchBoard(boardId) {
  appState.activeBoard = boardId;
  openForm = { columnId: null, cardId: null };
  searchQuery = "";
  searchInput.value = "";
  saveState();
  renderSidebar();
  renderBoard();
}

function deleteBoard(boardId) {
  if (appState.boards.length === 1) {
    alert("You need at least one board.");
    return;
  }

  if (!confirm("Delete this board?")) {
    return;
  }

  appState.boards = appState.boards.filter(function (board) {
    return board.id !== boardId;
  });

  if (appState.activeBoard === boardId) {
    appState.activeBoard = appState.boards[0].id;
  }

  saveState();
  renderSidebar();
  renderBoard();
}

function handleNewBoardSubmit() {
  createBoard(newBoardInput.value);
  newBoardInput.value = "";
}

function filterCards(query) {
  searchQuery = query;
  renderBoard();
}

function handleKeyboardShortcuts(event) {
  if (event.key === "Escape") {
    closeOpenForm();
  }
}

function initializeEvents() {
  themeToggleBtn.addEventListener("click", toggleTheme);
  newBoardBtn.addEventListener("click", handleNewBoardSubmit);
  addColumnBtn.addEventListener("click", addColumn);
  clearDoneBtn.addEventListener("click", clearDoneCards);

  newBoardInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleNewBoardSubmit();
    }
  });

  searchInput.addEventListener("input", function () {
    filterCards(searchInput.value);
  });

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

function startApp() {
  loadState();
  applyTheme();
  initializeEvents();
  renderSidebar();
  renderBoard();
}

document.addEventListener("DOMContentLoaded", startApp);
