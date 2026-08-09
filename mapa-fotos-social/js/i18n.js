// ============================================================
// i18n — troca de idioma (pt / en / es)
// ============================================================
export const dict = {
  pt: {
    brandName: "Mapa Vivo",
    brandTag: "Cada foto tem um lugar. Cada lugar tem uma história.",
    login: "Entrar",
    noAccount: "Criar conta nova",
    haveAccount: "Já tenho conta",
    signup: "Criar conta",
    choosePhoto: "Escolher foto de perfil",
    displayName: "Nome de exibição",
    password: "Senha",
    passwordMin: "Senha (mín. 6 caracteres)",
    searchPlaceholder: "Buscar por título ou descrição...",
    takePhoto: "Registrar foto aqui",
    myPhotos: "Minhas fotos",
    events: "Eventos no mapa",
    messages: "Conversas",
    language: "Idioma",
    deleteAccount: "Excluir conta",
    logout: "Sair",
    share: "Compartilhar",
    promote: "Divulgar como evento",
    writeComment: "Escreva um comentário...",
    send: "Enviar",
    titlePh: "Título",
    descPh: "Descrição",
    publish: "Publicar no mapa",
    message: "Mensagem",
    recentPhotos: "Fotos recentes",
    writeMessage: "Digite uma mensagem...",
    createEvent: "Criar evento para divulgar a foto",
    eventTitlePh: "Título do evento",
    eventDescPh: "Descrição do evento",
    confirmDeleteAccount: "Isso vai apagar sua conta e seus dados permanentemente. Digite sua senha para confirmar:",
    locating: "Localizando você...",
    photoPublished: "Foto publicada no mapa!",
    eventPublished: "Evento publicado!",
    linkCopied: "Link copiado!",
  },
  en: {
    brandName: "Live Map",
    brandTag: "Every photo has a place. Every place has a story.",
    login: "Log in",
    noAccount: "Create new account",
    haveAccount: "I already have an account",
    signup: "Create account",
    choosePhoto: "Choose profile photo",
    displayName: "Display name",
    password: "Password",
    passwordMin: "Password (min. 6 characters)",
    searchPlaceholder: "Search by title or description...",
    takePhoto: "Register photo here",
    myPhotos: "My photos",
    events: "Map events",
    messages: "Chats",
    language: "Language",
    deleteAccount: "Delete account",
    logout: "Log out",
    share: "Share",
    promote: "Promote as event",
    writeComment: "Write a comment...",
    send: "Send",
    titlePh: "Title",
    descPh: "Description",
    publish: "Publish to map",
    message: "Message",
    recentPhotos: "Recent photos",
    writeMessage: "Type a message...",
    createEvent: "Create event to promote this photo",
    eventTitlePh: "Event title",
    eventDescPh: "Event description",
    confirmDeleteAccount: "This will permanently delete your account and data. Type your password to confirm:",
    locating: "Locating you...",
    photoPublished: "Photo published to the map!",
    eventPublished: "Event published!",
    linkCopied: "Link copied!",
  },
  es: {
    brandName: "Mapa Vivo",
    brandTag: "Cada foto tiene un lugar. Cada lugar tiene una historia.",
    login: "Iniciar sesión",
    noAccount: "Crear cuenta nueva",
    haveAccount: "Ya tengo cuenta",
    signup: "Crear cuenta",
    choosePhoto: "Elegir foto de perfil",
    displayName: "Nombre para mostrar",
    password: "Contraseña",
    passwordMin: "Contraseña (mín. 6 caracteres)",
    searchPlaceholder: "Buscar por título o descripción...",
    takePhoto: "Registrar foto aquí",
    myPhotos: "Mis fotos",
    events: "Eventos en el mapa",
    messages: "Conversaciones",
    language: "Idioma",
    deleteAccount: "Eliminar cuenta",
    logout: "Cerrar sesión",
    share: "Compartir",
    promote: "Promocionar como evento",
    writeComment: "Escribe un comentario...",
    send: "Enviar",
    titlePh: "Título",
    descPh: "Descripción",
    publish: "Publicar en el mapa",
    message: "Mensaje",
    recentPhotos: "Fotos recientes",
    writeMessage: "Escribe un mensaje...",
    createEvent: "Crear evento para promocionar la foto",
    eventTitlePh: "Título del evento",
    eventDescPh: "Descripción del evento",
    confirmDeleteAccount: "Esto eliminará tu cuenta y datos permanentemente. Escribe tu contraseña para confirmar:",
    locating: "Ubicándote...",
    photoPublished: "¡Foto publicada en el mapa!",
    eventPublished: "¡Evento publicado!",
    linkCopied: "¡Enlace copiado!",
  }
};

let currentLang = localStorage.getItem("mapavivo_lang") || "pt";

export function t(key) {
  return (dict[currentLang] && dict[currentLang][key]) || dict.pt[key] || key;
}

export function getLang() {
  return currentLang;
}

export function applyLang(lang) {
  if (!dict[lang]) return;
  currentLang = lang;
  localStorage.setItem("mapavivo_lang", lang);

  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });
  document.querySelectorAll(".lang-switch button").forEach(b => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
  const sel = document.getElementById("lang-select");
  if (sel) sel.value = lang;

  document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
}

// Aplica assim que o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  applyLang(currentLang);
  document.querySelectorAll(".lang-switch button").forEach(btn => {
    btn.addEventListener("click", () => applyLang(btn.dataset.lang));
  });
  const sel = document.getElementById("lang-select");
  if (sel) sel.addEventListener("change", e => applyLang(e.target.value));
});
