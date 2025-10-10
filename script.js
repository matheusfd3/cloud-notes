// Seletores dos elementos HTML
const elements = {
  noteTitle: document.getElementById("note-title"),
  noteContent: document.getElementById("note-content"),
  titleWrapper: document.getElementById("title-wrapper"),
  contentWrapper: document.getElementById("content-wrapper"),
  btnOpen: document.getElementById("btn-open"),
  btnCollapse: document.getElementById("btn-collapse"),
  sidebar: document.querySelector(".sidebar"),
};

// Atualiza o estado do wrapper conforme o conteúdo do elemento
function updateEditableWrapperState(element, wrapper) {
  const hasText = element.textContent.trim().length > 0;
  wrapper.classList.toggle("is-empty", !hasText);
}

// Funções para abrir e fechar a sidebar
function openSidebar() {
  elements.sidebar.style.display = "flex";
  elements.btnOpen.style.display = "none";
}

function closeSidebar() {
  elements.sidebar.style.display = "none";
  elements.btnOpen.style.display = "block";
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

// Inicialização
function init() {
  attachAllEditableHandlers();
  updateAllEditableStates();

  // Estado inicial: sidebar aberta, botão de abrir oculto
  elements.sidebar.style.display = "";
  elements.btnOpen.style.display = "none";

  // Eventos para abrir/fechar sidebar
  elements.btnOpen.addEventListener("click", openSidebar);
  elements.btnCollapse.addEventListener("click", closeSidebar);
}

// Executa a inicialização ao carregar o script
init();
