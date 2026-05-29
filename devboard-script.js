const STORAGE_KEY = "devboard-state";

const DEFAULT_COLUMNS = ["TO DO", "IN PROGRESS", "REVIEW", "DONE"];

const CARD_COLORS = [
  "#00f5ff",
  "#bf5fff",
  "#39ff88",
  "#ffcc4d",
  "#ff4d6d",
  "#4d7cff"
];

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

/* Creates a unique id for boards, columns, and cards. */
function generateId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* Saves the full app state into localStorage. */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

/* Creates the default four kanban columns. */
function createDefaultColumns() {
  return DEFAULT_COLUMNS.map(function (columnTitle) {
    return {
      id: generateId("column"),
      title: columnTitle,
      cards: []
    };
  });
}

/* Creates starter data for first launch. */
function createDefaultState() {
  const defaultBoardId = generateId("board");
  const defaultColumns = createDefaultColumns();

  defaultColumns[0].cards.push({
    id: generateId("card"),
    title: "Build DevBoard card system",
    description: "Create, edit, delete, drag, search, and save project cards using appState.",
    priority: "HIGH",
    dueDate: "2025-06-01",
    color: "#bf5fff",
    createdAt: Date.now()
  });

  return {
    activeBoard: defaultBoardId,
    theme: "dark",
    boards: [
      {
        id: defaultBoardId,
        name: "My First Project",
        columns: defaultColumns
      }
    ]
  };
}

/* Loads saved data or creates starter data. */
function loadState() {
  const savedState = localStorage.getItem(STORAGE_KEY);

  if (savedState) {
    appState = JSON.parse(savedState);
  } else {
    appState = createDefaultState();
    saveState();
  }

  console.log(appState);
}

/* Finds and returns the currently active board. */
function getActiveBoard() {
  return appState.boards.find(function (board) {
    return board.id === appState.activeBoard;
  });
}

/* Finds a card and its parent column by card id. */
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
      return {
        card: card,
        column: column
      };
    }
  }

  return null;
}

/* Finds and returns a column by id from the active board. */
function findColumnById(columnId) {
  const activeBoard = getActiveBoard();

  if (!activeBoard) {
    return null;
  }

  return activeBoard.columns.find(function (column) {
    return column.id === columnId;
  });
}

/* Applies the current theme from appState. */
function applyTheme() {
  document.documentElement.classList.toggle(
    "light-theme",
    appState.theme === "light"
  );
}

/* Switches between dark and light themes. */
function toggleTheme() {
  appState.theme = appState.theme === "dark" ? "light" : "dark";

  saveState();
  applyTheme();
}

/* Renders all boards in the sidebar. */
function renderSidebar() {
  const boardList = document.getElementById("boardList");
  const activeBoardTitle = document.getElementById("activeBoardTitle");

  boardList.innerHTML = "";

  appState.boards.forEach(function (board) {
    const boardItem = document.createElement("button");

    boardItem.className =
      board.id === appState.activeBoard
        ? "board-item active"
        : "board-item";

    boardItem.innerHTML = `
      <span class="board-name">${board.name}</span>
      <span class="delete-board-btn">×</span>
    `;

    boardItem.addEventListener("click", function () {
      switchBoard(board.id);
    });

    boardItem.querySelector(".delete-board-btn").addEventListener("click", function (event) {
      event.stopPropagation();
      deleteBoard(board.id);
    });

    boardList.appendChild(boardItem);
  });

  const activeBoard = getActiveBoard();

  if (activeBoard) {
    activeBoardTitle.textContent = activeBoard.name;
  }
}

/* Renders every column and updates stats for the active board. */
function renderBoard() {
  const boardContainer = document.getElementById("boardContainer");
  const activeBoard = getActiveBoard();

  boardContainer.innerHTML = "";

  if (!activeBoard) {
    boardContainer.innerHTML = "No active board found.";
    return;
  }

  activeBoard.columns.forEach(function (column) {
    boardContainer.appendChild(renderColumn(column));
  });

  renderStats();
}

/* Builds one column element from one column object. */
function renderColumn(column) {
  const columnElement = document.createElement("div");

  columnElement.className = "board-column";
  columnElement.dataset.columnId = column.id;

  columnElement.innerHTML = `
    <div class="column-header">
      <div class="column-title-wrap">
        <h3 class="column-title">${column.title}</h3>
        <span class="column-count">${column.cards.length} cards</span>
      </div>

      <button class="delete-column-btn">×</button>
    </div>

    <div class="card-list"></div>

    <button class="add-card-btn">+ Add Card</button>
  `;

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

  const cardList = columnElement.querySelector(".card-list");

  if (column.cards.length === 0) {
    cardList.innerHTML = `<div class="empty-column-text">+ Drop cards here</div>`;
  }

  column.cards.forEach(function (card) {
    cardList.appendChild(renderCard(card, column.id));
  });

  if (openForm.columnId === column.id && openForm.cardId === null) {
    cardList.appendChild(createCardForm(column.id));
  }

  columnElement.querySelector(".delete-column-btn").addEventListener("click", function () {
    deleteColumn(column.id);
  });

  columnElement.querySelector(".add-card-btn").addEventListener("click", function () {
    createCard(column.id);
  });

  return columnElement;
}

/* Builds one card element from one card object. */
function renderCard(card, columnId) {
  const cardElement = document.createElement("article");

  const priorityClass = `priority-${card.priority.toLowerCase()}`;
  const cleanSearchQuery = searchQuery.trim().toLowerCase();
  const titleMatchesSearch = card.title.toLowerCase().includes(cleanSearchQuery);
  const isExpanded = expandedCards.includes(card.id);

  cardElement.className =
    cleanSearchQuery && !titleMatchesSearch
      ? "dev-card search-dimmed"
      : "dev-card";

  cardElement.draggable = true;
  cardElement.dataset.cardId = card.id;

  cardElement.innerHTML = `
    <div class="card-color-bar" style="background: ${card.color};"></div>

    <div class="card-top-row">
      <span class="priority-badge ${priorityClass}">
        ${card.priority}
      </span>

      <div class="card-actions">
        <button class="card-action-btn edit-card-btn">✎</button>
        <button class="card-action-btn card-delete-btn">×</button>
      </div>
    </div>

    <h4 class="card-title">${card.title}</h4>

    ${
      card.description
        ? `<p class="card-description ${isExpanded ? "" : "hidden"}">${card.description}</p>`
        : ""
    }

    ${
      card.dueDate
        ? `<span class="card-due-date">Due: ${card.dueDate}</span>`
        : ""
    }
  `;

  cardElement.addEventListener("dragstart", function (event) {
    event.dataTransfer.setData("cardId", card.id);
    event.dataTransfer.setData("sourceColumnId", columnId);
    cardElement.classList.add("dragging");
  });

  cardElement.addEventListener("dragend", function () {
    cardElement.classList.remove("dragging");
  });

  cardElement.querySelector(".card-title").addEventListener("click", function () {
    toggleCardExpand(card.id);
  });

  cardElement.querySelector(".edit-card-btn").addEventListener("click", function () {
    editCard(card.id);
  });

  cardElement.querySelector(".card-delete-btn").addEventListener("click", function () {
    deleteCard(card.id, columnId);
  });

  if (openForm.cardId === card.id) {
    cardElement.appendChild(createCardForm(columnId, card));
  }

  return cardElement;
}

/* Expands or collapses a card description. */
function toggleCardExpand(cardId) {
  if (expandedCards.includes(cardId)) {
    expandedCards = expandedCards.filter(function (id) {
      return id !== cardId;
    });
  } else {
    expandedCards.push(cardId);
  }

  renderBoard();
}

/* Moves a dragged card from one column to another. */
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

/* Opens a blank card form in a column. */
function createCard(columnId) {
  openForm = {
    columnId: columnId,
    cardId: null
  };

  renderBoard();
}

/* Builds the card form for creating or editing cards. */
function createCardForm(columnId, existingCard) {
  const formElement = document.createElement("form");

  const selectedColor = existingCard ? existingCard.color : CARD_COLORS[0];

  formElement.className = "card-form";

  formElement.innerHTML = `
    <input class="form-title" type="text" placeholder="Card title" value="${existingCard ? existingCard.title : ""}" required>

    <textarea class="form-description" placeholder="Card description">${existingCard ? existingCard.description : ""}</textarea>

    <select class="form-priority">
      <option value="LOW" ${existingCard && existingCard.priority === "LOW" ? "selected" : ""}>LOW</option>
      <option value="MEDIUM" ${existingCard && existingCard.priority === "MEDIUM" ? "selected" : ""}>MEDIUM</option>
      <option value="HIGH" ${existingCard && existingCard.priority === "HIGH" ? "selected" : ""}>HIGH</option>
    </select>

    <input class="form-due-date" type="date" value="${existingCard ? existingCard.dueDate : ""}">

    <div class="color-options">
      ${CARD_COLORS.map(function (color) {
        return `
          <button type="button" class="color-option ${color === selectedColor ? "active" : ""}" data-color="${color}" style="background: ${color};"></button>
        `;
      }).join("")}
    </div>

    <div class="form-actions">
      <button class="form-save-btn" type="submit">
        ${existingCard ? "Save Changes" : "Create Card"}
      </button>

      <button class="form-cancel-btn" type="button">
        Cancel
      </button>
    </div>
  `;

  let chosenColor = selectedColor;

  const colorButtons = formElement.querySelectorAll(".color-option");

  colorButtons.forEach(function (colorButton) {
    colorButton.addEventListener("click", function () {
      colorButtons.forEach(function (button) {
        button.classList.remove("active");
      });

      colorButton.classList.add("active");
      chosenColor = colorButton.dataset.color;
    });
  });

  formElement.addEventListener("submit", function (event) {
    event.preventDefault();

    const cardData = {
      title: formElement.querySelector(".form-title").value,
      description: formElement.querySelector(".form-description").value,
      priority: formElement.querySelector(".form-priority").value,
      dueDate: formElement.querySelector(".form-due-date").value,
      color: chosenColor
    };

    if (existingCard) {
      updateCard(existingCard.id, cardData);
    } else {
      saveCard(columnId, cardData);
    }
  });

  formElement.querySelector(".form-cancel-btn").addEventListener("click", function () {
    closeOpenForm();
  });

  setTimeout(function () {
    formElement.querySelector(".form-title").focus();
  }, 0);

  return formElement;
}

/* Closes any open create or edit form. */
function closeOpenForm() {
  openForm = {
    columnId: null,
    cardId: null
  };

  renderBoard();
}

/* Saves a new card into the correct column. */
function saveCard(columnId, cardData) {
  const targetColumn = findColumnById(columnId);

  if (!targetColumn || cardData.title.trim() === "") {
    alert("Card title is required.");
    return;
  }

  targetColumn.cards.push({
    id: generateId("card"),
    title: cardData.title.trim(),
    description: cardData.description.trim(),
    priority: cardData.priority,
    dueDate: cardData.dueDate,
    color: cardData.color,
    createdAt: Date.now()
  });

  closeOpenForm();
  saveState();
  renderBoard();
}

/* Opens the edit form for an existing card. */
function editCard(cardId) {
  const foundCard = findCardById(cardId);

  if (!foundCard) {
    return;
  }

  openForm = {
    columnId: foundCard.column.id,
    cardId: cardId
  };

  renderBoard();
}

/* Updates an existing card with new form data. */
function updateCard(cardId, cardData) {
  const foundCard = findCardById(cardId);

  if (!foundCard || cardData.title.trim() === "") {
    alert("Card title is required.");
    return;
  }

  foundCard.card.title = cardData.title.trim();
  foundCard.card.description = cardData.description.trim();
  foundCard.card.priority = cardData.priority;
  foundCard.card.dueDate = cardData.dueDate;
  foundCard.card.color = cardData.color;

  closeOpenForm();
  saveState();
  renderBoard();
}

/* Deletes a card from its column. */
function deleteCard(cardId, columnId) {
  const targetColumn = findColumnById(columnId);

  if (!targetColumn) {
    return;
  }

  const confirmed = confirm("Delete this card?");

  if (!confirmed) {
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

/* Adds a custom column to the active board. */
function addColumn() {
  const activeBoard = getActiveBoard();

  if (!activeBoard) {
    return;
  }

  const columnName = prompt("Enter column name:");

  if (!columnName || columnName.trim() === "") {
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

/* Deletes a column from the active board. */
function deleteColumn(columnId) {
  const activeBoard = getActiveBoard();

  if (!activeBoard) {
    return;
  }

  const confirmed = confirm("Delete this column?");

  if (!confirmed) {
    return;
  }

  activeBoard.columns = activeBoard.columns.filter(function (column) {
    return column.id !== columnId;
  });

  saveState();
  renderBoard();
}

/* Updates search text and re-renders cards with dimmed non-matches. */
function filterCards(query) {
  searchQuery = query;
  renderBoard();
}

/* Renders total and per-column card counts. */
function renderStats() {
  const statsBar = document.getElementById("statsBar");
  const activeBoard = getActiveBoard();

  if (!statsBar || !activeBoard) {
    return;
  }

  let totalCards = 0;

  const columnStats = activeBoard.columns.map(function (column) {
    totalCards += column.cards.length;

    return `
      <span class="stat-pill pop">
        ${column.title}: <strong>${column.cards.length}</strong>
      </span>
    `;
  });

  statsBar.innerHTML = `
    <span class="stat-pill pop">
      TOTAL: <strong>${totalCards}</strong>
    </span>
    ${columnStats.join("")}
  `;

  setTimeout(function () {
    statsBar.querySelectorAll(".stat-pill").forEach(function (pill) {
      pill.classList.remove("pop");
    });
  }, 220);
}

/* Removes all cards from the DONE column after confirmation. */
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

  const confirmed = confirm("Clear all cards from DONE?");

  if (!confirmed) {
    return;
  }

  doneColumn.cards = [];

  saveState();
  renderBoard();
}

/* Creates a new board and makes it active. */
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

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.value = "";
  }

  saveState();
  renderSidebar();
  renderBoard();
}

/* Switches the active board by id. */
function switchBoard(boardId) {
  appState.activeBoard = boardId;

  openForm = {
    columnId: null,
    cardId: null
  };

  searchQuery = "";

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.value = "";
  }

  saveState();
  renderSidebar();
  renderBoard();
}

/* Deletes a board and safely switches to another board. */
function deleteBoard(boardId) {
  if (appState.boards.length === 1) {
    alert("You need at least one board.");
    return;
  }

  const confirmed = confirm("Delete this board?");

  if (!confirmed) {
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

/* Handles the new board input and button. */
function handleNewBoardSubmit() {
  const newBoardInput = document.getElementById("newBoardInput");

  createBoard(newBoardInput.value);

  newBoardInput.value = "";
}

/* Handles global keyboard shortcuts. */
function handleKeyboardShortcuts(event) {
  if (event.key === "Escape") {
    closeOpenForm();
  }
}

/* Sets up button and input event listeners. */
function initializeEvents() {
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const newBoardBtn = document.getElementById("newBoardBtn");
  const newBoardInput = document.getElementById("newBoardInput");
  const addColumnBtn = document.getElementById("addColumnBtn");
  const searchInput = document.getElementById("searchInput");
  const clearDoneBtn = document.getElementById("clearDoneBtn");

  themeToggleBtn.addEventListener("click", toggleTheme);
  newBoardBtn.addEventListener("click", handleNewBoardSubmit);
  addColumnBtn.addEventListener("click", addColumn);
  clearDoneBtn.addEventListener("click", clearDoneCards);

  newBoardInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      handleNewBoardSubmit();
    }
  });

  searchInput.addEventListener("keyup", function () {
    filterCards(searchInput.value);
  });

  document.addEventListener("keydown", handleKeyboardShortcuts);
}

loadState();
applyTheme();

document.addEventListener("DOMContentLoaded", function () {
  initializeEvents();
  renderSidebar();
  renderBoard();
});