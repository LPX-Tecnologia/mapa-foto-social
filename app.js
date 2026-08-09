// ============================================================
// APP.JS — lógica principal do Mapa Vivo
// ============================================================
import { auth, db, storage } from "./firebase-config.js";
import { t, getLang } from "./i18n.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, reauthenticateWithCredential, EmailAuthProvider,
  deleteUser, updateProfile
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc, collection, addDoc,
  query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// ---------- estado global ----------
let map, myMarker;
let myUid = null, myProfile = null;
let myPosition = null; // {lat, lng}
let markersById = { users: {}, photos: {}, events: {} };
let pendingPhotoBlob = null, pendingPhotoMeta = null;
let currentPhotoId = null;
let currentProfileUid = null;
let currentChatUid = null;
let unsubscribeChat = null;

const $ = (id) => document.getElementById(id);
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add("hidden"), 2600);
}
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ============================================================
// AUTENTICAÇÃO
// ============================================================
$("goto-signup").onclick = () => { $("auth-login").classList.add("hidden"); $("auth-signup").classList.remove("hidden"); };
$("goto-login").onclick = () => { $("auth-signup").classList.add("hidden"); $("auth-login").classList.remove("hidden"); };

$("signup-photo").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  $("signup-photo-preview").src = url;
  $("signup-photo-preview").classList.remove("hidden");
});
document.querySelector(".file-pick").addEventListener("click", () => $("signup-photo").click());

$("btn-signup").onclick = async () => {
  const name = $("signup-name").value.trim();
  const email = $("signup-email").value.trim();
  const pass = $("signup-password").value;
  const photoFile = $("signup-photo").files[0];
  $("signup-error").textContent = "";
  if (!name || !email || pass.length < 6) {
    $("signup-error").textContent = t("passwordMin");
    return;
  }
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    let photoURL = "";
    if (photoFile) {
      const r = ref(storage, `profile_photos/${cred.user.uid}.jpg`);
      await uploadBytes(r, photoFile);
      photoURL = await getDownloadURL(r);
    }
    await updateProfile(cred.user, { displayName: name, photoURL });
    await setDoc(doc(db, "users", cred.user.uid), {
      displayName: name, email, photoURL,
      location: null, createdAt: serverTimestamp(), lastActive: serverTimestamp()
    });
  } catch (err) {
    $("signup-error").textContent = err.message;
  }
};

$("btn-login").onclick = async () => {
  $("login-error").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("login-email").value.trim(), $("login-password").value);
  } catch (err) {
    $("login-error").textContent = err.message;
  }
};

$("menu-logout").onclick = () => signOut(auth);

$("menu-delete-account").onclick = async () => {
  const pass = prompt(t("confirmDeleteAccount"));
  if (!pass) return;
  try {
    const cred = EmailAuthProvider.credential(auth.currentUser.email, pass);
    await reauthenticateWithCredential(auth.currentUser, cred);
    await deleteDoc(doc(db, "users", myUid));
    await deleteUser(auth.currentUser);
    toast("Conta excluída.");
  } catch (err) {
    toast(err.message);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    myUid = user.uid;
    const snap = await getDoc(doc(db, "users", myUid));
    myProfile = snap.exists() ? snap.data() : { displayName: user.displayName, photoURL: user.photoURL, email: user.email };
    $("auth-screen").classList.add("hidden");
    $("app-screen").classList.remove("hidden");
    $("my-avatar-topbar").src = myProfile.photoURL || defaultAvatar();
    $("my-avatar-menu").src = myProfile.photoURL || defaultAvatar();
    $("my-name-menu").textContent = myProfile.displayName || "";
    $("my-email-menu").textContent = myProfile.email || "";
    startApp();
  } else {
    myUid = null;
    $("app-screen").classList.add("hidden");
    $("auth-screen").classList.remove("hidden");
  }
});

function defaultAvatar() {
  return "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#1F2630'/><text x='50%' y='55%' font-size='34' fill='#3FD9C7' text-anchor='middle'>?</text></svg>`
  );
}

// ============================================================
// MAPA
// ============================================================
function startApp() {
  if (!map) initMap();
  locateAndTrack();
  loadPhotos();
  loadNearbyUsers();
  loadEvents();
}

function initMap() {
  map = L.map("map", { zoomControl: false }).setView([-23.5, -46.6], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19
  }).addTo(map);
  L.control.zoom({ position: "bottomleft" }).addTo(map);
}

function locateAndTrack() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(async (pos) => {
    myPosition = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    map.setView([myPosition.lat, myPosition.lng], map.getZoom() < 14 ? 14 : map.getZoom());
    placeMyMarker();
    if (myUid) {
      await updateDoc(doc(db, "users", myUid), { location: myPosition, lastActive: serverTimestamp() }).catch(() => {});
    }
  }, () => toast("Não foi possível obter sua localização."), { enableHighAccuracy: true });
}

function placeMyMarker() {
  const html = `<div class="user-marker"><img src="${myProfile.photoURL || defaultAvatar()}"/></div>`;
  const icon = L.divIcon({ html, className: "", iconSize: [52, 52] });
  if (myMarker) {
    myMarker.setLatLng([myPosition.lat, myPosition.lng]);
  } else {
    myMarker = L.marker([myPosition.lat, myPosition.lng], { icon, zIndexOffset: 1000 }).addTo(map);
    myMarker.bindPopup(t("myPhotos"));
  }
}

// ----- outros usuários no mapa -----
async function loadNearbyUsers() {
  const snap = await getDocs(collection(db, "users"));
  snap.forEach((d) => {
    const u = d.data();
    if (d.id === myUid || !u.location) return;
    const html = `<div class="user-marker other"><img src="${u.photoURL || defaultAvatar()}"/></div>`;
    const icon = L.divIcon({ html, className: "", iconSize: [52, 52] });
    const marker = L.marker([u.location.lat, u.location.lng], { icon }).addTo(map);
    marker.on("click", () => openProfile(d.id));
    markersById.users[d.id] = marker;
  });
}

// ============================================================
// FOTOS
// ============================================================
let photosCache = {};

async function loadPhotos() {
  const q = query(collection(db, "photos"), orderBy("createdAt", "desc"), limit(150));
  const snap = await getDocs(q);
  snap.forEach((d) => addPhotoMarker(d.id, d.data()));
}

function addPhotoMarker(id, data) {
  photosCache[id] = data;
  const html = `<div class="photo-marker"><img src="${data.photoURL}"/></div>`;
  const icon = L.divIcon({ html, className: "", iconSize: [46, 46] });
  const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);
  marker.on("click", () => openPhotoModal(id));
  markersById.photos[id] = marker;
}

$("btn-take-photo").onclick = () => $("camera-input").click();

$("camera-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!myPosition) { toast(t("locating")); return; }
  pendingPhotoBlob = file;
  const preview = URL.createObjectURL(file);
  $("new-photo-preview").src = preview;
  $("new-photo-title").value = "";
  $("new-photo-desc").value = "";
  $("new-photo-meta").textContent = t("locating");
  openModal("modal-new-photo");

  const weather = await fetchWeather(myPosition.lat, myPosition.lng);
  pendingPhotoMeta = { lat: myPosition.lat, lng: myPosition.lng, weather };
  $("new-photo-meta").textContent = weather ? `${weather.temp}°C · ${weather.desc}` : "";
});

async function fetchWeather(lat, lng) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
    const data = await res.json();
    const code = data.current_weather.weathercode;
    return { temp: Math.round(data.current_weather.temperature), desc: weatherCodeToText(code) };
  } catch {
    return null;
  }
}
function weatherCodeToText(code) {
  const map = {
    0: "Céu limpo", 1: "Poucas nuvens", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Neblina", 48: "Neblina", 51: "Garoa", 61: "Chuva", 63: "Chuva", 65: "Chuva forte",
    71: "Neve", 80: "Pancadas de chuva", 95: "Tempestade"
  };
  return map[code] || "—";
}

$("btn-publish-photo").onclick = async () => {
  if (!pendingPhotoBlob || !pendingPhotoMeta) return;
  const title = $("new-photo-title").value.trim() || "Sem título";
  const description = $("new-photo-desc").value.trim();
  try {
    const path = `photos/${myUid}/${Date.now()}.jpg`;
    const r = ref(storage, path);
    await uploadBytes(r, pendingPhotoBlob);
    const photoURL = await getDownloadURL(r);

    const docRef = await addDoc(collection(db, "photos"), {
      uid: myUid,
      displayName: myProfile.displayName,
      ownerPhotoURL: myProfile.photoURL || "",
      photoURL, title, description,
      lat: pendingPhotoMeta.lat, lng: pendingPhotoMeta.lng,
      weather: pendingPhotoMeta.weather,
      createdAt: serverTimestamp(),
      likes: [], likeCount: 0, commentCount: 0
    });
    addPhotoMarker(docRef.id, {
      uid: myUid, displayName: myProfile.displayName, photoURL, title, description,
      lat: pendingPhotoMeta.lat, lng: pendingPhotoMeta.lng, weather: pendingPhotoMeta.weather,
      likes: [], likeCount: 0, commentCount: 0
    });
    closeModal("modal-new-photo");
    toast(t("photoPublished"));
    pendingPhotoBlob = null; pendingPhotoMeta = null;
  } catch (err) {
    toast(err.message);
  }
};

// ---------- detalhe da foto / curtir / comentar / compartilhar / evento ----------
async function openPhotoModal(id) {
  currentPhotoId = id;
  const snap = await getDoc(doc(db, "photos", id));
  if (!snap.exists()) return;
  const p = snap.data();
  photosCache[id] = p;

  $("photo-detail-img").src = p.photoURL;
  $("photo-detail-title").textContent = p.title;
  $("photo-detail-desc").textContent = p.description || "";
  $("photo-detail-date").textContent = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString(getLang()) : "";
  $("photo-detail-weather").textContent = p.weather ? `☁ ${p.weather.temp}°C · ${p.weather.desc}` : "";
  $("photo-detail-owner").innerHTML = `<img src="${p.ownerPhotoURL || defaultAvatar()}"/> <span>${p.displayName}</span>`;
  $("photo-detail-owner").onclick = () => { closeModal("modal-photo"); openProfile(p.uid); };

  const liked = (p.likes || []).includes(myUid);
  $("like-icon").textContent = liked ? "❤️" : "🤍";
  $("like-count").textContent = p.likeCount || 0;
  $("btn-like").classList.toggle("liked", liked);
  $("comment-count").textContent = p.commentCount || 0;
  $("comments-section").classList.add("hidden");

  openModal("modal-photo");
}

$("btn-like").onclick = async () => {
  if (!currentPhotoId) return;
  const p = photosCache[currentPhotoId];
  const liked = (p.likes || []).includes(myUid);
  const ref_ = doc(db, "photos", currentPhotoId);
  if (liked) {
    await updateDoc(ref_, { likes: arrayRemove(myUid), likeCount: increment(-1) });
    p.likes = p.likes.filter(u => u !== myUid); p.likeCount = (p.likeCount || 1) - 1;
  } else {
    await updateDoc(ref_, { likes: arrayUnion(myUid), likeCount: increment(1) });
    p.likes = [...(p.likes || []), myUid]; p.likeCount = (p.likeCount || 0) + 1;
  }
  $("like-icon").textContent = !liked ? "❤️" : "🤍";
  $("like-count").textContent = p.likeCount;
  $("btn-like").classList.toggle("liked", !liked);
};

$("btn-comment-toggle").onclick = async () => {
  const sec = $("comments-section");
  sec.classList.toggle("hidden");
  if (!sec.classList.contains("hidden")) await loadComments(currentPhotoId);
};

async function loadComments(photoId) {
  const q = query(collection(db, "photos", photoId, "comments"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  $("comments-list").innerHTML = "";
  snap.forEach(d => {
    const c = d.data();
    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `<b>${c.displayName}:</b> ${c.text}`;
    $("comments-list").appendChild(div);
  });
}

$("btn-comment-send").onclick = async () => {
  const text = $("comment-input").value.trim();
  if (!text || !currentPhotoId) return;
  await addDoc(collection(db, "photos", currentPhotoId, "comments"), {
    uid: myUid, displayName: myProfile.displayName, text, createdAt: serverTimestamp()
  });
  await updateDoc(doc(db, "photos", currentPhotoId), { commentCount: increment(1) });
  $("comment-input").value = "";
  $("comment-count").textContent = (parseInt($("comment-count").textContent) || 0) + 1;
  await loadComments(currentPhotoId);
};

$("btn-share").onclick = async () => {
  const url = `${location.origin}${location.pathname}#photo=${currentPhotoId}`;
  if (navigator.share) {
    navigator.share({ title: "Mapa Vivo", url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    toast(t("linkCopied"));
  }
};

$("btn-make-event").onclick = () => {
  $("event-title").value = "";
  $("event-desc").value = "";
  openModal("modal-new-event");
};

$("btn-publish-event").onclick = async () => {
  const p = photosCache[currentPhotoId];
  const title = $("event-title").value.trim() || p.title;
  const description = $("event-desc").value.trim();
  const docRef = await addDoc(collection(db, "events"), {
    uid: myUid, displayName: myProfile.displayName,
    photoId: currentPhotoId, photoURL: p.photoURL,
    title, description, lat: p.lat, lng: p.lng, createdAt: serverTimestamp()
  });
  addEventMarker(docRef.id, { title, description, lat: p.lat, lng: p.lng, photoURL: p.photoURL });
  closeModal("modal-new-event");
  closeModal("modal-photo");
  toast(t("eventPublished"));
};

// ============================================================
// EVENTOS NO MAPA
// ============================================================
async function loadEvents() {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  snap.forEach(d => addEventMarker(d.id, d.data()));
}

function addEventMarker(id, data) {
  const icon = L.divIcon({ html: `<div class="event-marker">📣</div>`, className: "", iconSize: [50, 50] });
  const marker = L.marker([data.lat, data.lng], { icon }).addTo(map);
  marker.bindPopup(`<strong>${data.title}</strong><br/>${data.description || ""}`);
  marker.on("click", () => {
    map.setView([data.lat, data.lng], 16);
    if (data.photoId) openPhotoModal(data.photoId);
  });
  markersById.events[id] = marker;
}

$("menu-events").onclick = () => {
  toggleMenu(false);
  const ids = Object.keys(markersById.events);
  if (!ids.length) { toast("Nenhum evento no momento."); return; }
  const group = L.featureGroup(Object.values(markersById.events));
  map.fitBounds(group.getBounds().pad(0.3));
};

// ============================================================
// PERFIL DE OUTRA PESSOA + CHAT
// ============================================================
async function openProfile(uid) {
  currentProfileUid = uid;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const u = snap.data();
  $("profile-avatar").src = u.photoURL || defaultAvatar();
  $("profile-name").textContent = u.displayName;

  const q = query(collection(db, "photos"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(9));
  const psnap = await getDocs(q);
  $("profile-photos").innerHTML = "";
  psnap.forEach(d => {
    const p = d.data();
    const img = document.createElement("img");
    img.src = p.photoURL;
    img.onclick = () => { closeModal("modal-profile"); openPhotoModal(d.id); };
    $("profile-photos").appendChild(img);
  });
  openModal("modal-profile");
}

$("menu-my-photos").onclick = () => { toggleMenu(false); openProfile(myUid); };

$("btn-open-chat").onclick = () => {
  closeModal("modal-profile");
  openChat(currentProfileUid);
};

function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

async function openChat(otherUid) {
  currentChatUid = otherUid;
  const otherSnap = await getDoc(doc(db, "users", otherUid));
  $("chat-with-name").textContent = otherSnap.exists() ? otherSnap.data().displayName : "";
  $("chat-messages").innerHTML = "";
  openModal("modal-chat");

  const chatId = chatIdFor(myUid, otherUid);
  const chatDocRef = doc(db, "chats", chatId);
  const chatSnap = await getDoc(chatDocRef);
  if (!chatSnap.exists()) {
    await setDoc(chatDocRef, { participants: [myUid, otherUid], lastAt: serverTimestamp(), lastMessage: "" });
  }

  if (unsubscribeChat) unsubscribeChat();
  const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
  unsubscribeChat = onSnapshot(q, (snap) => {
    $("chat-messages").innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "chat-bubble " + (m.from === myUid ? "mine" : "theirs");
      div.textContent = m.text;
      $("chat-messages").appendChild(div);
    });
    $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  });
}

$("btn-chat-send").onclick = async () => {
  const text = $("chat-input").value.trim();
  if (!text || !currentChatUid) return;
  const chatId = chatIdFor(myUid, currentChatUid);
  await addDoc(collection(db, "chats", chatId, "messages"), { from: myUid, text, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "chats", chatId), { lastMessage: text, lastAt: serverTimestamp() });
  $("chat-input").value = "";
};

$("menu-chats").onclick = async () => {
  toggleMenu(false);
  const q = query(collection(db, "chats"), where("participants", "array-contains", myUid), orderBy("lastAt", "desc"));
  const snap = await getDocs(q);
  const panel = $("search-results");
  panel.innerHTML = "";
  if (snap.empty) { toast("Nenhuma conversa ainda."); return; }
  for (const d of snap.docs) {
    const c = d.data();
    const otherUid = c.participants.find(u => u !== myUid);
    const otherSnap = await getDoc(doc(db, "users", otherUid));
    const other = otherSnap.exists() ? otherSnap.data() : { displayName: "?" };
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `<img src="${other.photoURL || defaultAvatar()}"/><div><div>${other.displayName}</div><div class="rt">${c.lastMessage || ""}</div></div>`;
    div.onclick = () => { panel.classList.add("hidden"); openChat(otherUid); };
    panel.appendChild(div);
  }
  panel.classList.remove("hidden");
};

// ============================================================
// BUSCA
// ============================================================
$("search-input").addEventListener("input", (e) => {
  const term = e.target.value.trim().toLowerCase();
  $("btn-search-clear").classList.toggle("hidden", !term);
  const panel = $("search-results");
  if (!term) { panel.classList.add("hidden"); return; }
  const results = Object.entries(photosCache).filter(([id, p]) =>
    (p.title || "").toLowerCase().includes(term) || (p.description || "").toLowerCase().includes(term)
  ).slice(0, 20);
  panel.innerHTML = "";
  if (!results.length) {
    panel.innerHTML = `<div class="result-item">Nenhum resultado</div>`;
  } else {
    results.forEach(([id, p]) => {
      const div = document.createElement("div");
      div.className = "result-item";
      div.innerHTML = `<img src="${p.photoURL}"/><div><div>${p.title}</div><div class="rt">${p.description || ""}</div></div>`;
      div.onclick = () => {
        panel.classList.add("hidden");
        map.setView([p.lat, p.lng], 16);
        openPhotoModal(id);
      };
      panel.appendChild(div);
    });
  }
  panel.classList.remove("hidden");
});
$("btn-search-clear").onclick = () => {
  $("search-input").value = "";
  $("btn-search-clear").classList.add("hidden");
  $("search-results").classList.add("hidden");
};

// ============================================================
// MENU LATERAL / MODAIS (utilitários)
// ============================================================
function toggleMenu(show) {
  $("side-menu").classList.toggle("hidden", !show);
  $("side-menu-backdrop").classList.toggle("hidden", !show);
}
$("btn-menu").onclick = () => toggleMenu(true);
$("side-menu-backdrop").onclick = () => toggleMenu(false);
$("btn-profile").onclick = () => openProfile(myUid);

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }
document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal").id));
});
document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", (e) => { if (e.target === m) closeModal(m.id); });
});
