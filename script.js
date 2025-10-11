// Chave para identificar os dados salvos pela nossa aplicação no navegador.
const STORAGE_KEY = "cloudnotes_storage";

// Estado carregar notas salvas e exibir.
const state = {
  notes: [],
  selectedId: null,
};

// Seletores dos elementos HTML
const elements = {
  modeIndicator: document.getElementById("mode-indicator"),
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
  titleWrapper: document.getElementById("title-wrapper"),
  contentWrapper: document.getElementById("content-wrapper"),
  btnOpen: document.getElementById("btn-open"),
  btnCollapse: document.getElementById("btn-collapse"),
  sidebar: document.getElementById("sidebar"),
  btnSave: document.getElementById("btn-save"),
  list: document.getElementById("note-list"),
  search: document.getElementById("search-input"),
  btnNew: document.getElementById("btn-new"),
  btnCopy: document.getElementById("btn-copy"),
};

// Funções para abrir e fechar a sidebar
function openSidebar() {
  elements.sidebar.classList.add("open");
  elements.sidebar.classList.remove("collapsed");
}

function closeSidebar() {
  elements.sidebar.classList.remove("open");
  elements.sidebar.classList.add("collapsed");
}

// Atualiza o estado do wrapper conforme o conteúdo do elemento
function updateEditableWrapperState(element, wrapper) {
  const hasText = element.textContent.trim().length > 0;
  wrapper.classList.toggle("is-empty", !hasText);
}

// Atualiza o estado de todos os elementos editáveis
function updateAllEditableStates() {
  updateEditableWrapperState(elements.noteTitle, elements.titleWrapper);
  updateEditableWrapperState(elements.noteContent, elements.contentWrapper);
}

// Adiciona ouvintes de input para atualizar wrappers em tempo real
function attachAllEditableHandlers() {
  elements.noteTitle.addEventListener("input", function () {
    updateEditableWrapperState(elements.noteTitle, elements.titleWrapper);
  });

  elements.noteContent.addEventListener("input", function () {
    updateEditableWrapperState(elements.noteContent, elements.contentWrapper);
  });
}

function setSelectedNote(id = null) {
  state.selectedId = id;

  // Atualiza o texto do indicador de modo
  if (elements.modeIndicator) {
    elements.modeIndicator.textContent = id ? "" : "✨";
  }
}

function save() {
  const title = elements.noteTitle.textContent.trim();
  const content = elements.noteContent.innerHTML.trim();
  const hasContent = elements.noteContent.textContent.trim();

  if (!title || !hasContent) {
    alert("Título e conteúdo não podem estar vazios.");
    return;
  }

  if (state.selectedId) {
    // Editando uma nota existente
    const existingNote = state.notes.find((n) => n.id === state.selectedId);

    if (existingNote) {
      existingNote.title = title || "Sem título";
      existingNote.content = content || "Sem conteúdo";
    }
  } else {
    // Criando uma nova nota
    const newNote = {
      id: Date.now().toString(36),
      title,
      content,
    };

    state.notes.unshift(newNote);
    setSelectedNote(newNote.id);
  }

  renderList(elements.search.value);
  persist();
  alert("Nota salva com sucesso!");
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notes));
  } catch (error) {
    console.log("Erro ao salvar no localStorage:", error);
  }
}

function load() {
  try {
    const storage = localStorage.getItem(STORAGE_KEY);
    state.notes = storage ? JSON.parse(storage) : [];
    setSelectedNote(null);
  } catch (error) {
    console.log("Erro ao carregar do localStorage:", error);
  }
}

function createNoteItem(note) {
  const tmp = document.createElement("div");
  tmp.innerHTML = note.content;
  return `
    <li class="note-item" data-id="${note.id}" data-action="select">
      <div class="note-item-content">
        <span class="note-item-title">${note.title}</span>
        <span class="note-item-description">${tmp.textContent}</span>
      </div>

      <button class="btn-icon" title="Remover" data-action="remove">
        <img src="assets/remove.svg" alt="Remover" class="icon icon-trash" />
      </button>
    </li>
  `;
}

function renderList(filterText = "") {
  const filteredNotes = state.notes
    .filter((note) =>
      note.title.toLowerCase().includes(filterText.toLowerCase().trim())
    )
    .map((n) => createNoteItem(n))
    .join("");

  elements.list.innerHTML = filteredNotes;
}

function newNote() {
  setSelectedNote(null);
  elements.noteTitle.textContent = "";
  elements.noteContent.textContent = "";
  updateAllEditableStates();
  elements.noteTitle.focus();
}

function copySelected() {
  try {
    const content = elements.noteContent;

    if (!navigator.clipboard) {
      console.error("Clipboard API não suportada neste ambiente.");
      return;
    }

    navigator.clipboard.writeText(content.innerText);

    alert("Conteúdo copiado para a área de transferência!");
  } catch (error) {
    console.log("Erro ao copiar para a área de transferência:", error);
  }
}

// Eventos
elements.btnSave.addEventListener("click", save);
elements.btnNew.addEventListener("click", newNote);
elements.btnCopy.addEventListener("click", copySelected);
elements.btnOpen.addEventListener("click", openSidebar);
elements.btnCollapse.addEventListener("click", closeSidebar);

elements.search.addEventListener("input", function (event) {
  renderList(event.target.value);
});

elements.list.addEventListener("click", function (event) {
  const removeBtn = event.target.closest("[data-action='remove']");
  const item = event.target.closest("[data-id]");

  if (!item) return;

  const id = item.getAttribute("data-id");

  if (removeBtn) {
    // Remover nota.
    state.notes = state.notes.filter((n) => n.id !== id);
    renderList(elements.search.value);
    persist();
    if (state.selectedId === id) {
      newNote();
    }
    return;
  }

  if (event.target.closest("[data-action='select']")) {
    const note = state.notes.find((n) => n.id === id);

    if (note) {
      elements.noteTitle.textContent = note.title;
      elements.noteContent.innerHTML = note.content;
      setSelectedNote(id);
      updateAllEditableStates();
      if (window.innerWidth <= 950) {
        closeSidebar();
      }
    }
  }
});

// Inicialização
function init() {
  load();
  renderList("");
  attachAllEditableHandlers();
  updateAllEditableStates();

  // Estado inicial: sidebar aberta (desktop) ou fechada (mobile)
  elements.sidebar.classList.remove("open");
  elements.sidebar.classList.remove("collapsed");
}

// Executa a inicialização ao carregar o script
init();
