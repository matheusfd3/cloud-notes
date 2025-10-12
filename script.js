import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  ref,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

import { auth, db } from "./firebase-config.js";

// Estado carregar notas salvas e exibir.
const state = {
  notes: [],
  selectedId: null,
};

// Seletores dos elementos HTML
const elements = {
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
  modeIndicator: document.getElementById("mode-indicator"),
  loadingWrapper: document.getElementById("loading-wrapper"),
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

function setSelectedNote(id = null) {
  state.selectedId = id;

  const note = state.notes.find((n) => n.id === id);

  if (note) {
    elements.noteTitle.innerHTML = note.title;
    elements.noteContent.innerHTML = note.content;
    elements.modeIndicator.textContent = "";
  } else {
    elements.noteTitle.innerHTML = "";
    elements.noteContent.innerHTML = "";
    elements.modeIndicator.textContent = "✨";
    elements.noteTitle.focus();
  }

  updateAllEditableStates();
}

function save() {
  const title = elements.noteTitle.innerHTML.trim();
  const content = elements.noteContent.innerHTML.trim();
  const hasTitle = elements.noteTitle.textContent.trim();
  const hasContent = elements.noteContent.textContent.trim();

  if (!hasTitle || !hasContent) {
    alert("Título e conteúdo não podem estar vazios.");
    return;
  }

  if (state.selectedId) {
    // Editando uma nota existente
    const existingNote = state.notes.find((n) => n.id === state.selectedId);

    if (existingNote) {
      existingNote.title = title;
      existingNote.content = content;
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

async function persist() {
  const user = auth.currentUser;

  if (user) {
    const notesRef = ref(db, "cloudNotes");

    try {
      await set(notesRef, state.notes);
      console.log("Estado salvo com sucesso no Realtime Database!");
    } catch (error) {
      console.error("Erro ao salvar o estado:", error);
    }
  } else {
    console.log("Usuário não autenticado. Não é possível salvar dados.");
  }
}

function setupNotesListener() {
  const user = auth.currentUser;

  if (user) {
    const notesRef = ref(db, "cloudNotes");

    // onValue() configura um listener que será acionado sempre que os dados mudarem
    onValue(
      notesRef,
      (snapshot) => {
        const data = snapshot.val();
        state.notes = data ? data : [];

        renderList(elements.search.value);
        setSelectedNote(state.selectedId);

        elements.loadingWrapper.classList.remove("is-loading");
      },
      (error) => {
        console.error("Erro ao carregar o estado:", error);
      }
    );
  } else {
    console.log("Usuário não autenticado. Não é possível carregar dados.");
    // Redirecionar para login ou exibir mensagem
  }
}

function createNoteItem(note) {
  return `
    <li class="note-item" data-id="${note.id}" data-action="select">
      <div class="note-item-content">
        <span class="note-item-title">${note.title}</span>
        <span class="note-item-description">${note.content}</span>
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
elements.btnNew.addEventListener("click", () => setSelectedNote());
elements.btnCopy.addEventListener("click", copySelected);
elements.btnOpen.addEventListener("click", openSidebar);
elements.btnCollapse.addEventListener("click", closeSidebar);

elements.search.addEventListener("input", function (event) {
  renderList(event.target.value);
});

elements.noteTitle.addEventListener("input", function () {
  updateEditableWrapperState(elements.noteTitle, elements.titleWrapper);
});

elements.noteContent.addEventListener("input", function () {
  updateEditableWrapperState(elements.noteContent, elements.contentWrapper);
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
      setSelectedNote();
    }
    return;
  }

  if (event.target.closest("[data-action='select']")) {
    setSelectedNote(id);
    if (window.innerWidth <= 950) {
      closeSidebar();
    }
  }
});

// Inicialização
function init() {
  // Estado inicial: sidebar aberta (desktop) ou fechada (mobile)
  elements.sidebar.classList.remove("open");
  elements.sidebar.classList.remove("collapsed");

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      setupNotesListener();
    } else {
      let authSuccess = false;
      const email = "admin@cloudnotes.com";
      while (!authSuccess) {
        const password = prompt("Código de acesso:");
        await signInWithEmailAndPassword(auth, email, password)
          .then(() => {
            authSuccess = true;
          })
          .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            alert("Error [" + errorCode + "]: " + errorMessage);
          });
      }
    }
  });
}

// Executa a inicialização ao carregar o script
init();
