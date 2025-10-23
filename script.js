import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import {
  ref as dbRef,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

import { auth, db, storage } from "./firebase-config.js";

// Estado carregar notas salvas e exibir.
const state = {
  notes: [],
  selectedId: null,
  pendingAddedFiles: [],
  pendingRemovedFiles: [],
};

// Seletores dos elementos HTML
const elements = {
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
  fileInput: document.getElementById("file-input"),
  fileList: document.getElementById("file-list"),
  titleWrapper: document.getElementById("title-wrapper"),
  contentWrapper: document.getElementById("content-wrapper"),
  btnOpen: document.getElementById("btn-open"),
  btnCollapse: document.getElementById("btn-collapse"),
  sidebar: document.getElementById("sidebar"),
  btnSave: document.getElementById("btn-save"),
  noteList: document.getElementById("note-list"),
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
  state.pendingAddedFiles = [];
  state.pendingRemovedFiles = [];

  const note = state.notes.find((n) => n.id === id);

  if (note) {
    elements.noteTitle.textContent = note.title;
    elements.noteContent.innerHTML = note.content;
    elements.modeIndicator.textContent = "";
  } else {
    elements.noteTitle.textContent = "";
    elements.noteContent.innerHTML = "";
    elements.modeIndicator.textContent = "✨";
    elements.noteTitle.focus();
  }

  renderFileList();
  updateAllEditableStates();
}

// Salva a nota atual (nova ou editada)
async function save() {
  const title = elements.noteTitle.textContent.trim();
  const content = elements.noteContent.innerHTML.trim();
  const hasContent = elements.noteContent.textContent.trim();

  if (!title || !hasContent) {
    showNotification("Título e conteúdo não podem estar vazios.", "error");
    return;
  }

  elements.loadingWrapper.classList.add("is-loading");

  let note;
  if (state.selectedId) {
    // Editando uma nota existente
    note = state.notes.find((n) => n.id === state.selectedId);
    if (note) {
      note.title = title;
      note.content = content;
    }
  } else {
    // Criando uma nova nota
    note = {
      id: crypto.randomUUID(),
      title,
      content,
    };
    state.notes.unshift(note);
  }
  renderNoteList(elements.search.value);
  const updatedFiles = await persistFiles(note);
  note.files = updatedFiles;
  setSelectedNote(note.id);

  await persist();
  elements.loadingWrapper.classList.remove("is-loading");
}

async function persistFiles(note) {
  const user = auth.currentUser;

  if (!user) {
    showNotification("Usuário não autenticado.", "error");
    return;
  }
  try {
    const addedFiles = [];
    const removedFiles = [];

    // Adicionar arquivos
    for (const file of state.pendingAddedFiles) {
      const fileRef = storageRef(storage, `notes/${note.id}/${file.name}`);
      await uploadBytes(fileRef, file.file);
      const url = await getDownloadURL(fileRef);

      delete file.file;

      addedFiles.push({
        ...file,
        status: "saved",
        url,
      });
    }

    // Remover arquivos
    for (const fileName of state.pendingRemovedFiles) {
      const fileRef = storageRef(storage, `notes/${note.id}/${fileName}`);
      await deleteObject(fileRef);
      removedFiles.push(fileName);
    }

    // Retorna a lista final de arquivos da nota
    const finalFiles = (
      note.files?.filter((file) => !removedFiles.includes(file.name)) || []
    ).concat(addedFiles);

    return finalFiles;
  } catch (error) {
    showNotification("Erro ao persistir arquivos.", "error");
    console.error("Erro ao persistir arquivos:", error);
  }
}

// Persiste o estado atual no Firebase Realtime Database
async function persist() {
  const user = auth.currentUser;

  if (!user) {
    showNotification("Usuário não autenticado.", "error");
    return;
  }

  const notesRef = dbRef(db, "cloudNotes");

  try {
    await set(notesRef, state.notes);
    showNotification("Estado salvo com sucesso!", "success");
  } catch (error) {
    showNotification("Erro ao salvar o estado.", "error");
    console.error("Erro ao salvar o estado:", error);
  }
}

// Configura o listener para mudanças no Firebase Realtime Database
function setupNotesListener() {
  const user = auth.currentUser;

  if (user) {
    const notesRef = dbRef(db, "cloudNotes");

    onValue(
      notesRef,
      (snapshot) => {
        const data = snapshot.val();
        state.notes = data ? data : [];

        renderNoteList(elements.search.value);
        setSelectedNote(state.selectedId);

        elements.loadingWrapper.classList.remove("is-loading");
      },
      (error) => {
        showNotification("Erro ao carregar notas", "error");
        console.error("Erro ao carregar notas:", error);
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
        <img src="assets/remove.svg" alt="Remover" class="icon-trash" />
      </button>
    </li>
  `;
}

// Renderiza a lista de notas, aplicando o filtro de busca se fornecido
function renderNoteList(filterText = "") {
  const filteredNotes = state.notes
    .filter((n) =>
      n.title.toLowerCase().includes(filterText.toLowerCase().trim())
    )
    .map((n) => createNoteItem(n))
    .join("");

  elements.noteList.innerHTML = filteredNotes;
}

// Função para criar o HTML de um item de arquivo
function createFileItem(file) {
  const isImage = file.type?.startsWith("image/");
  const imageSrc =
    file.status === "saved" ? file.url : URL.createObjectURL(file.file);

  const imageTag = isImage
    ? `<img src="${imageSrc}" alt="${file.name}" class="file-thumb" />`
    : `<img src="assets/document.svg" alt="Arquivo" class="file-icon" />`;

  const statusSpan =
    file.status === "pending"
      ? `
        <span class="file-status pending">não salvo</span>
      `
      : `
        <span class="file-status saved">salvo</span>
      `;

  return `
    <li 
      class="file-item ${file.status}" 
      data-id="${file.id}" 
      data-status="${file.status}" 
      data-url="${file.url}" 
      data-name="${file.name}"
      title="${file.status === "saved" ? "Baixar arquivo" : "Não salvo"}"
      ${file.status === "saved" ? `data-action="download"` : ""}
    >
      <div class="file-info">
        ${imageTag}
        <span class="file-name">${file.name}</span>
      </div>
      <div class="file-actions">
        ${statusSpan}
        <button class="btn-icon" data-action="remove" title="Remover arquivo">
          <img src="assets/close.svg" alt="Remover" class="icon-close" />
        </button>
      </div>
    </li>
  `;
}

// Renderiza a lista de arquivos anexados à nota selecionada
function renderFileList() {
  elements.fileList.innerHTML = "";

  let savedFiles = "";
  if (state.selectedId) {
    const note = state.notes.find((n) => n.id === state.selectedId);
    const files = Array.isArray(note.files) ? note.files : [];
    savedFiles = files
      .filter((file) => !state.pendingRemovedFiles.includes(file.name))
      .map((file) => createFileItem(file))
      .join("");
  }

  const pendingFiles =
    state.pendingAddedFiles.map((file) => createFileItem(file)).join("") || "";

  elements.fileList.innerHTML = savedFiles + pendingFiles;
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
  renderNoteList(event.target.value);
});

elements.noteTitle.addEventListener("input", function () {
  updateEditableWrapperState(elements.noteTitle, elements.titleWrapper);
});

elements.noteContent.addEventListener("input", function () {
  updateEditableWrapperState(elements.noteContent, elements.contentWrapper);
});

elements.fileInput.addEventListener("change", () => {
  const newFiles = Array.from(elements.fileInput.files).map((file) => ({
    id: crypto.randomUUID(),
    name: file.name,
    type: file.type,
    status: "pending",
    file: file,
  }));

  const note = state.notes.find((n) => n.id === state.selectedId);

  for (const newFile of newFiles) {
    const alreadyPending = state.pendingAddedFiles.some(
      (f) => f.name === newFile.name
    );
    const alreadyInNote =
      note?.files?.some((f) => f.name === newFile.name) ?? false;

    if (alreadyPending || alreadyInNote) {
      showNotification(
        `O arquivo "${newFile.name}" já foi adicionado!`,
        "warning"
      );
    } else {
      state.pendingAddedFiles.unshift(newFile);
    }
  }

  renderFileList();

  elements.fileInput.value = "";
});

elements.fileList.addEventListener("click", function (event) {
  const removeBtn = event.target.closest("[data-action='remove']");
  const item = event.target.closest("[data-id]");

  if (!item) return;

  const id = item.getAttribute("data-id");
  const name = item.getAttribute("data-name");
  const status = item.getAttribute("data-status");
  const url = item.getAttribute("data-url");

  if (removeBtn) {
    if (status === "pending") {
      // Remover arquivo pendente
      state.pendingAddedFiles = state.pendingAddedFiles.filter(
        (file) => file.id !== id
      );
    } else if (status === "saved") {
      // Marcar arquivo salvo para remoção
      state.pendingRemovedFiles.push(name);
    }
    renderFileList();
    return;
  }

  if (event.target.closest("[data-action='download']")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    link.click();
  }
});

elements.noteList.addEventListener("click", function (event) {
  const removeBtn = event.target.closest("[data-action='remove']");
  const item = event.target.closest("[data-id]");

  if (!item) return;

  const id = item.getAttribute("data-id");
  const note = state.notes.find((n) => n.id === id);

  if (removeBtn) {
    // Remover arquivos, se houver
    if (note?.files?.length) {
      for (const file of note.files) {
        const fileRef = storageRef(storage, `notes/${note.id}/${file.name}`);
        deleteObject(fileRef).catch((err) => {
          console.error(`Erro ao deletar arquivo "${file.name}":`, err);
        });
      }
    }
    // Remover nota.
    state.notes = state.notes.filter((n) => n.id !== id);
    renderNoteList(elements.search.value);
    if (state.selectedId === id) {
      setSelectedNote();
    }

    persist();
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
