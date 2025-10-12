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
  notificationWrapper: document.getElementById("notification-wrapper"),
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

function showNotification(message, type, duration = 3000) {
  const notification = createNotification(message, type);
  elements.notificationWrapper.appendChild(notification);

  // Animar entrada
  setTimeout(() => {
    notification.classList.add("show-notification");
  }, 100);

  // Auto-remover após duração especificada
  setTimeout(() => {
    removeNotification(notification);
  }, duration);
}

function createNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;

  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${getNotificationIcon(type)}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;

  return notification;
}

function removeNotification(notification) {
  notification.classList.add("hide-notification");
  setTimeout(() => {
    notification.remove();
  }, 400);
}

function getNotificationIcon(type) {
  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };
  return icons[type] || icons.info;
}

// Atualiza o estado do wrapper conforme o conteúdo do elemento
function updateEditableWrapperState(element, wrapper) {
  const hasText = element.textContent.trim().length > 0;
  wrapper.classList.toggle("is-empty", !hasText);
}

function updateAllEditableStates() {
  updateEditableWrapperState(elements.noteTitle, elements.titleWrapper);
  updateEditableWrapperState(elements.noteContent, elements.contentWrapper);
}

// Define a nota selecionada e atualiza a interface
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

// Salva a nota atual (nova ou editada)
function save() {
  const title = elements.noteTitle.innerHTML.trim();
  const content = elements.noteContent.innerHTML.trim();
  const hasTitle = elements.noteTitle.textContent.trim();
  const hasContent = elements.noteContent.textContent.trim();

  if (!hasTitle || !hasContent) {
    showNotification("Título e conteúdo não podem estar vazios.", "error");
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
}

// Persiste o estado atual no Firebase Realtime Database
async function persist() {
  const user = auth.currentUser;

  if (user) {
    const notesRef = ref(db, "cloudNotes");

    try {
      await set(notesRef, state.notes);
      showNotification("Estado salvo com sucesso!", "success");
    } catch (error) {
      showNotification("Erro ao salvar o estado.", "error");
      console.error("Erro ao salvar o estado:", error);
    }
  } else {
    showNotification("Usuário não autenticado.", "error");
  }
}

// Configura o listener para mudanças no Firebase Realtime Database
function setupNotesListener() {
  const user = auth.currentUser;

  if (user) {
    const notesRef = ref(db, "cloudNotes");

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
        showNotification("Erro ao carregar notas", "error");
      }
    );
  } else {
    showNotification("Usuário não autenticado.", "error");
  }
}

// Função para criar o HTML de um item de anotação
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

// Renderiza a lista de notas, aplicando o filtro de busca se fornecido
function renderList(filterText = "") {
  const filteredNotes = state.notes
    .filter((note) =>
      note.title.toLowerCase().includes(filterText.toLowerCase().trim())
    )
    .map((n) => createNoteItem(n))
    .join("");

  elements.list.innerHTML = filteredNotes;
}

// Copia o conteúdo da nota selecionada para a área de transferência
function copySelected() {
  try {
    const content = elements.noteContent;

    if (!navigator.clipboard) {
      showNotification("Clipboard API não suportada neste ambiente.", "error");
      return;
    }

    navigator.clipboard.writeText(content.innerText);

    showNotification(
      "Conteúdo copiado para a área de transferência!",
      "success"
    );
  } catch (error) {
    showNotification("Erro ao copiar para a área de transferência.", "error");
    console.error("Erro ao copiar para a área de transferência:", error);
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
    // Selecionar nota.
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

  // Autenticação Firebase
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
            showNotification("Autenticado com sucesso!", "success");
          })
          .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            console.error(
              `Erro de autenticação [${errorCode}]: ${errorMessage}`
            );
            showNotification("Erro de autenticação.", "error");
          });
      }
    }
  });
}

init();
