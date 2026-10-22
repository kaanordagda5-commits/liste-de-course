import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, allowedEmails } from "./config.js";

// Une seule liste commune pour la famille.
const LIST = "lists/famille/items";
const VERSION = "v19";
// Document spécial (dans la même collection) qui garde les réglages communs, comme l'ordre des rayons.
const SETTINGS_ID = "_reglages";
// Couleur de chaque personne : orange saumon pour Mattia, bleu clair pour Francesca.
const PERSON_CLASS = { "kaanordagda5@gmail.com": "p-green", "francesca.jardini@gmail.com": "p-blue" };
const NAME_CLASS = { mattia: "p-green", ma: "p-green", francesca: "p-blue" };

// Les couleurs sont posées ici plutôt que dans index.html, pour qu'elles arrivent avec ce fichier
// même si le téléphone a gardé une ancienne page en mémoire.
const personStyle = document.createElement("style");
personStyle.textContent = `
  :root { --green-soft: #fde4da; --blue-soft: #e1f0fc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --green-soft: #3b2620; --blue-soft: #1a2c3a; } }
  :root[data-theme="dark"] { --green-soft: #3b2620; --blue-soft: #1a2c3a; }
  li.row.p-green { background: var(--green-soft); }
  li.row.p-blue { background: var(--blue-soft); }
  .typeahead { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .typeahead:empty { display: none; }
  .mic { flex: none; width: 48px; min-height: 48px; border-radius: 12px; border: 1.5px solid var(--line); background: var(--card); color: var(--accent); display: grid; place-items: center; cursor: pointer; }
  .mic svg { width: 22px; height: 22px; }
  .mic.listening { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
  .aisle-select { flex: none; max-width: 46%; font: inherit; font-size: 0.9rem; padding: 8px; margin-right: 8px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--card); color: var(--fg); }
  .order { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .order li { display: flex; align-items: center; gap: 6px; padding: 6px 8px 6px 14px; border-top: 1px solid var(--line); }
  .order li:first-child { border-top: 0; }
  .order li span { flex: 1; min-width: 0; }
  .order button { width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid var(--line); background: none; color: var(--fg); font-size: 1.1rem; cursor: pointer; }
  .order button:disabled { opacity: 0.3; cursor: default; }
  .editbar { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 22px; }
  .cardbtn { display: inline-flex; align-items: center; gap: 8px; }
  .cardbtn svg { width: 20px; height: 20px; }
  .card-view { position: fixed; inset: 0; z-index: 50; background: #ffffff; color: #1d2a22; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px;
    padding: calc(16px + env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) calc(16px + env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); }
  .card-view img { max-width: 100%; max-height: 62vh; object-fit: contain; border-radius: 12px; }
  .card-view p { margin: 0; text-align: center; color: #5f6f64; max-width: 34ch; }
  .card-view .actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
  .card-view .ghost { color: #1d2a22; border-color: #d9e2da; background: #ffffff; }
  .card-tabs { display: flex; gap: 6px; padding: 4px; border-radius: 999px; background: #eef2ee; }
  .card-tab { border: 0; border-radius: 999px; padding: 10px 18px; font: inherit; font-weight: 700; background: transparent; color: #5f6f64; cursor: pointer; }
  .card-tab.on { background: #ffffff; color: #1d2a22; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
  .card-view h2 { color: #1d2a22; font-size: 1.1rem; text-transform: none; letter-spacing: 0; }
  .aisle-card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
  .aisle-head { display: flex; align-items: center; gap: 6px; padding: 8px; background: var(--accent-soft); }
  .aisle-head input { flex: 1; min-width: 0; font: inherit; font-weight: 700; padding: 8px 10px; border-radius: 10px; border: 1.5px solid transparent; background: transparent; color: var(--fg); }
  .aisle-head input:focus { border-color: var(--accent); background: var(--card); outline: none; }
  .aisle-head button { flex: none; width: 40px; height: 40px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--card); color: var(--fg); font-size: 1.05rem; cursor: pointer; display: grid; place-items: center; }
  .aisle-head button svg { width: 18px; height: 18px; }
  .aisle-head button:disabled { opacity: 0.3; cursor: default; }
  .aisle-items { list-style: none; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; }
  .aisle-items li { display: flex; align-items: center; gap: 8px; padding: 6px 8px 6px 14px; border-top: 1px solid var(--line); }
  .aisle-items li span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .aisle-items .item-name { flex: 1; min-width: 0; font: inherit; padding: 7px 8px; margin-left: -8px; border-radius: 10px; border: 1.5px solid transparent; background: transparent; color: var(--fg); }
  .aisle-items .item-name:focus { border-color: var(--accent); background: var(--card); outline: none; }
  .aisle-items .item-del { flex: none; width: 40px; height: 40px; border-radius: 10px; border: 0; background: none; color: var(--muted); display: grid; place-items: center; cursor: pointer; }
  .aisle-items .item-del svg { width: 18px; height: 18px; }
  .aisle-items .none { color: var(--muted); font-size: 0.9rem; padding: 10px 14px; }
  .aisle-items select { flex: none; max-width: 42%; font: inherit; font-size: 0.85rem; padding: 7px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--card); color: var(--fg); }
  .manager { display: flex; flex-direction: column; gap: 14px; }
  .confirm { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 10px 14px; border-top: 1px solid var(--line); font-size: 0.9rem; }
  .confirm .danger { background: var(--warn); color: #fff; border: 0; border-radius: 10px; padding: 8px 12px; font-weight: 700; cursor: pointer; }
`;
document.head.append(personStyle);

// Rayons proposés au départ (les mots servaient à deviner le rayon ; désormais un nouvel article va dans « Inconnu »).
const AISLES = [
  ["Fruits et légumes", "pomme banane poire orange citron fraise raisin tomate salade carotte oignon ail patate courgette poivron concombre avocat champignon herbe persil basilic legume fruit kiwi melon poireau epinard"],
  ["Frais", "lait beurre yaourt yogourt fromage creme oeuf jambon poulet viande steak poisson saumon lardon emmental mozzarella parmesan dessert"],
  ["Pain", "pain baguette brioche croissant"],
  ["Épicerie", "pate riz farine sucre sel poivre huile vinaigre cafe the chocolat cereale biscuit confiture miel conserve sauce moutarde ketchup mayonnaise lentille semoule"],
  ["Boissons", "eau jus soda biere vin coca sirop"],
  ["Surgelés", "surgele glace frite pizza"],
  ["Maison et hygiène", "papier essuie lessive vaisselle eponge savon shampoing dentifrice brosse couche poubelle mouchoir douche deodorant"],
];
// « Inconnu » reçoit chaque nouvel article, pour qu'on le range ensuite dans le bon rayon.
const UNKNOWN = "Inconnu";
const DEFAULT_ORDER = [UNKNOWN].concat(AISLES.map(a => a[0]), ["Divers"]);
// Un rayon a un identifiant fixe (stocké sur les articles) et un nom modifiable.
let aisleOrder = DEFAULT_ORDER.slice();   // identifiants, dans l'ordre du magasin
let aisleNames = {};                      // identifiant -> nom choisi (sinon le nom d'origine)
let hiddenAisles = [];                    // rayons d'origine supprimés
const aisleName = id => aisleNames[id] || id;
// Rayon réellement affiché pour un article (sans rayon ou rayon supprimé : « Inconnu »).
const aisleOf = it => (it.aisle && aisleOrder.includes(it.aisle)) ? it.aisle : UNKNOWN;
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
const STAR_ON = STAR.replace('fill="none"', 'fill="currentColor"');
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const BIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
function setStatus(text, err) {
  const s = $("status"); s.textContent = text; s.className = "status" + (err ? " err" : ""); s.hidden = !text;
  // Une erreur reste visible même si la page se recharge, jusqu'à la prochaine connexion réussie.
  try { if (err) localStorage.setItem("lastError", text); } catch (e) {}
}
function clearError() { try { localStorage.removeItem("lastError"); } catch (e) {} }
function savedError() { try { return localStorage.getItem("lastError") || ""; } catch (e) { return ""; } }

// status : "todo" (à prendre), "cart" (dans le panier), "stock" (essentiel à racheter), "history" (déjà acheté, sert aux suggestions)
let items = [];     // {id, name, aisle, status, staple}
let editMode = false;
let cards = {};        // cartes de fidélité communes : nom de la carte -> document le plus récent
let cardOpen = false;
let col = null;
let stopList = null;
let me = "";
let myEmail = "";       // prénom de la personne connectée, enregistré sur chaque article ajouté

// --- Démarrage Firebase ---
if (firebaseConfig.apiKey === "A_REMPLIR") {
  setStatus("L'appli n'est pas encore reliée à Firebase : il faut remplir config.js.", true);
  throw new Error("config.js à remplir");
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = "fr";
// Cache local : la liste reste lisible et modifiable sans réseau (fond du magasin), puis se synchronise.
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// Message gardé à l'écran après une connexion refusée (sinon la déconnexion l'effacerait).
let deniedMessage = "";

function authError(e) {
  const code = (e && e.code) || "inconnu";
  const msg = {
    "auth/unauthorized-domain": "Firebase refuse cette adresse de site. Ajoutez kaanordagda5-commits.github.io dans Authentication > Paramètres > Domaines autorisés.",
    "auth/operation-not-allowed": "La connexion Google n'est pas activée dans Firebase (Authentication > Mode de connexion).",
    "auth/popup-blocked": "Le navigateur a bloqué la fenêtre de connexion Google. Autorisez les fenêtres pop-up pour ce site, puis réessayez.",
    "auth/network-request-failed": "Pas de connexion internet. Réessayez quand le réseau revient.",
  }[code] || "La connexion n'a pas marché.";
  setStatus(msg + " (code : " + code + ")", true);
}

$("signinBtn").onclick = async () => {
  deniedMessage = ""; clearError();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  setStatus("Connexion en cours…");
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") { setStatus(""); return; }
    if (e.code === "auth/operation-not-supported-in-this-environment") { await signInWithRedirect(auth, provider); return; }
    authError(e);
  }
};
getRedirectResult(auth).catch(authError);
$("signout").onclick = () => signOut(auth);

onAuthStateChanged(auth, user => {
  if (stopList) { stopList(); stopList = null; }
  items = []; col = null;
  if (!user) {
    $("signin").hidden = false; $("main").hidden = true; $("count").textContent = "";
    const err = deniedMessage || savedError();
    if (err) setStatus(err, true);
    else setStatus("");
    return;
  }
  const email = (user.email || "").toLowerCase();
  if (!allowedEmails.map(e => e.toLowerCase()).includes(email)) {
    $("signin").hidden = false; $("main").hidden = true;
    deniedMessage = "Le compte " + (email || "(sans e-mail)") + " n'a pas accès à cette liste. Connectez-vous avec un compte autorisé.";
    setStatus(deniedMessage, true);
    signOut(auth);
    return;
  }
  clearError(); deniedMessage = "";
  myEmail = email;
  me = ((user.displayName || "").trim().split(/\s+/)[0]) || email.split("@")[0];
  $("signin").hidden = true; $("main").hidden = false;
  $("who").textContent = "Connecté : " + email + " · " + VERSION;
  setStatus("Chargement de la liste…");
  col = collection(db, LIST);
  stopList = onSnapshot(col, snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const settings = all.find(d => d.id === SETTINGS_ID);
    hiddenAisles = (settings && Array.isArray(settings.hiddenAisles)) ? settings.hiddenAisles : [];
    aisleNames = (settings && settings.aisleNames) || {};
    aisleOrder = mergeOrder(settings && settings.aisleOrder);
    cards = {};
    for (const d of all) if (d.kind === "card" && d.photo) {
      const label = d.label || "Supercard";
      if (!cards[label] || (d.updatedAt || 0) > (cards[label].updatedAt || 0)) cards[label] = d;
    }
    items = all.filter(d => d.id !== SETTINGS_ID && d.kind !== "settings" && d.kind !== "card");
    if (cardOpen) renderCard();
    setStatus(snap.metadata.fromCache ? "Hors ligne : vos changements partiront dès le retour du réseau." : "");
    render();
  }, e => setStatus("La liste n'a pas pu être lue. Vérifiez les règles Firestore. (code : " + (e && e.code) + ")", true));
  render();
});

// --- Écritures ---
// Firestore garde les écritures en attente hors ligne, donc on n'attend pas le serveur pour mettre à jour l'écran.
function failed(e) { setStatus("La modification n'est pas passée. (code : " + ((e && e.code) || "inconnu") + ")", true); }
const write = (id, patch) => updateDoc(doc(col, id), patch).catch(failed);
const remove = id => deleteDoc(doc(col, id)).catch(failed);

// Ajoute un article, ou remet sur la liste un article déjà connu (il garde alors son rayon).
function addName(raw) {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name || !col) return;
  const same = items.find(i => norm(i.name) === norm(name));
  if (same) { if (same.status !== "todo") write(same.id, { status: "todo", addedBy: me, addedByEmail: myEmail }); return; }
  const nice = name.charAt(0).toUpperCase() + name.slice(1);
  addDoc(col, { name: nice, aisle: UNKNOWN, status: "todo", staple: false, addedBy: me, addedByEmail: myEmail, createdAt: Date.now() }).catch(failed);
}

const input = $("newItem");
$("addForm").addEventListener("submit", ev => {
  ev.preventDefault();
  addName(input.value);
  input.value = "";
  renderTypeahead();
  input.focus();
});

// --- Suggestions en tapant : tout ce qui a déjà été acheté ---
input.removeAttribute("list");
input.placeholder = "Ajouter un article";
const typeahead = el("div", "typeahead");
typeahead.id = "typeahead";
$("addForm").after(typeahead);
input.addEventListener("input", renderTypeahead);

function renderTypeahead() {
  const q = norm(input.value);
  typeahead.innerHTML = "";
  if (!q) return;
  const known = items.filter(i => i.status !== "todo" && norm(i.name) !== q);
  const starts = known.filter(i => norm(i.name).startsWith(q));
  const inside = known.filter(i => !norm(i.name).startsWith(q) && norm(i.name).includes(q));
  for (const it of starts.sort(byName).concat(inside.sort(byName)).slice(0, 6)) {
    const c = el("button", "chip", "<b>+</b> "); c.type = "button";
    c.append(document.createTextNode(it.name));
    c.setAttribute("aria-label", "Ajouter : " + it.name);
    c.onclick = () => { addName(it.name); input.value = ""; renderTypeahead(); input.focus(); };
    typeahead.append(c);
  }
}

// --- Ajout à la voix ---
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (Recognition) {
  const mic = el("button", "mic", MIC);
  mic.type = "button"; mic.id = "mic";
  mic.setAttribute("aria-label", "Dicter des articles");
  mic.title = "Dicter des articles, par exemple : pâtes, tomates et parmesan";
  $("addBtn").before(mic);
  let rec = null;
  let heard = "";      // texte entendu, affiché dans le champ pendant qu'on parle
  let done = false;    // vrai quand la phrase finale a été traitée
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new Recognition();
    rec.lang = "fr-FR"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    heard = ""; done = false;
    rec.onstart = () => { mic.classList.add("listening"); setStatus("Je vous écoute… dites par exemple « pâtes, tomates et parmesan »."); };
    rec.onaudiostart = () => setStatus("Micro ouvert, parlez maintenant…");
    rec.onresult = e => {
      let text = "", final = false;
      for (let i = 0; i < e.results.length; i++) { text += e.results[i][0].transcript; if (e.results[i].isFinal) final = true; }
      heard = text.trim();
      input.value = heard;
      if (final && !done) {
        done = true;
        const names = heard.split(/,|\bet\b|\bpuis\b|\bensuite\b/i).map(x => x.trim()).filter(Boolean);
        names.forEach(addName);
        input.value = "";
        renderTypeahead();
        setStatus(names.length ? "Ajouté : " + names.join(", ") : "");
      }
    };
    rec.onerror = e => {
      done = true;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus("Le micro est bloqué pour ce site. Dans Chrome : ⋮ > Paramètres > Paramètres des sites > Micro, puis autorisez ce site. (code : " + e.error + ")", true);
      else if (e.error === "no-speech") setStatus("Je n'ai rien entendu. Touchez le micro et réessayez.");
      else if (e.error === "aborted") setStatus("");
      else setStatus("La dictée n'a pas marché. (code : " + e.error + ")", true);
    };
    rec.onend = () => {
      mic.classList.remove("listening"); rec = null;
      // Si la phrase n'a pas été validée, on la laisse dans le champ : il suffit de toucher « Ajouter ».
      if (!done) setStatus(heard ? "Vérifiez le texte puis touchez « Ajouter »." : "Je n'ai rien entendu. Touchez le micro et réessayez.");
    };
    try { rec.start(); } catch (err) { rec = null; setStatus("La dictée n'a pas pu démarrer. (" + (err && err.message) + ")", true); }
  };
}

// --- Rayons : changer le rayon d'un article et l'ordre des rayons ---
function mergeOrder(saved) {
  const known = a => DEFAULT_ORDER.includes(a) || a.startsWith("r-");
  const list = Array.isArray(saved) ? saved.filter(a => known(a) && !hiddenAisles.includes(a)) : [];
  const rest = DEFAULT_ORDER.filter(a => !list.includes(a) && !hiddenAisles.includes(a));
  // « Inconnu » arrive en haut tant qu'on ne l'a pas déplacé.
  const merged = list.includes(UNKNOWN) ? list.concat(rest) : [UNKNOWN].concat(list, rest.filter(x => x !== UNKNOWN));
  // « Inconnu » existe toujours.
  if (!merged.includes(UNKNOWN)) merged.unshift(UNKNOWN);
  return merged;
}
function saveSettings() {
  render();
  setDoc(doc(col, SETTINGS_ID), { kind: "settings", aisleOrder, aisleNames, hiddenAisles }).catch(failed);
}
function saveOrder(order) { aisleOrder = order; saveSettings(); }
function renameAisle(id, name) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean || clean === aisleName(id)) return;
  aisleNames = { ...aisleNames, [id]: clean };
  saveSettings();
}
function addAisle(name) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return;
  const id = "r-" + Date.now().toString(36);
  aisleNames = { ...aisleNames, [id]: clean };
  aisleOrder = aisleOrder.concat([id]);
  saveSettings();
}
function deleteAisle(id) {
  if (id === UNKNOWN) return;
  for (const it of items.filter(i => i.aisle === id)) write(it.id, { aisle: UNKNOWN });
  aisleOrder = aisleOrder.filter(a => a !== id);
  if (DEFAULT_ORDER.includes(id)) hiddenAisles = hiddenAisles.concat([id]);
  const n = { ...aisleNames }; delete n[id]; aisleNames = n;
  confirmDelete = null;
  saveSettings();
}
let confirmDelete = null;   // rayon dont on demande la confirmation de suppression
const editBar = el("div", "editbar");
const editBtn = el("button", "ghost"); editBtn.type = "button"; editBtn.id = "editAisles";
editBar.append(editBtn);
$("main").querySelector(".who").before(editBar);
editBtn.onclick = () => { editMode = !editMode; confirmDelete = null; render(); window.scrollTo(0, 0); };

// Les articles achetés restent en mémoire ("history") pour les suggestions ; les essentiels vont dans « À racheter ? ».
$("finish").addEventListener("click", () => {
  for (const it of items.filter(i => i.status === "cart")) write(it.id, { status: it.staple ? "stock" : "history" });
});

// --- Affichage ---
function row(it) {
  const who = PERSON_CLASS[(it.addedByEmail || "").toLowerCase()] || NAME_CLASS[norm(it.addedBy || "")] || "";
  const li = el("li", "row" + (it.status === "cart" ? " done" : "") + (who ? " " + who : ""));
  const tick = el("button", "tick");
  tick.type = "button";
  tick.setAttribute("aria-label", (it.status === "cart" ? "Remettre sur la liste : " : "Mettre dans le panier : ") + it.name);
  tick.append(el("span", "box"));
  const nm = el("span", "name"); nm.textContent = it.name; tick.append(nm);
  tick.onclick = () => write(it.id, { status: it.status === "cart" ? "todo" : "cart" });
  li.append(tick);
  const star = el("button", "icon", it.staple ? STAR_ON : STAR);
  star.type = "button"; star.setAttribute("aria-pressed", it.staple ? "true" : "false");
  star.setAttribute("aria-label", "Article essentiel : " + it.name);
  star.title = it.staple ? "Essentiel (revient après les courses)" : "Marquer comme essentiel";
  star.onclick = () => write(it.id, { staple: !it.staple });
  li.append(star);
  // Retire l'article de la liste sans l'effacer : il reste dans son rayon et dans les suggestions.
  // (La suppression définitive se fait dans « Gérer les rayons ».)
  const del = el("button", "icon", CROSS);
  del.type = "button"; del.setAttribute("aria-label", "Retirer de la liste : " + it.name); del.title = "Retirer de la liste";
  del.onclick = () => write(it.id, { status: it.staple ? "stock" : "history" });
  li.append(del);
  return li;
}

const byName = (a, b) => a.name.localeCompare(b.name, "fr");

function render() {
  const todo = items.filter(i => i.status === "todo");
  const cart = items.filter(i => i.status === "cart").sort(byName);
  const stock = items.filter(i => i.status === "stock").sort(byName);
  $("count").textContent = todo.length ? todo.length + (todo.length > 1 ? " articles à prendre" : " article à prendre") : "";

  const box = $("todo"); box.innerHTML = "";
  if (!todo.length) {
    const hint = stock.length
      ? "Tapez un article au-dessus, ou touchez un essentiel dans « À racheter ? »."
      : "Tapez un article au-dessus. Astuce : l'étoile ☆ marque un article que vous achetez souvent ; après « Courses terminées », il apparaîtra ici dans « À racheter ? » pour le remettre en un geste.";
    box.append(el("div", "empty", "<strong>Rien à acheter pour l'instant</strong>" + hint));
  } else {
    for (const aisle of aisleOrder) {
      const these = todo.filter(i => aisleOf(i) === aisle).sort(byName);
      if (!these.length) continue;
      const g = el("div", "group");
      const h = el("h2"); h.textContent = aisleName(aisle); g.append(h);
      const ul = el("ul"); these.forEach(i => ul.append(row(i))); g.append(ul);
      box.append(g);
    }
  }

  $("cartBox").hidden = !cart.length;
  const cu = $("cart"); cu.innerHTML = "";
  cart.forEach(i => cu.append(row(i)));

  $("suggestBox").hidden = !stock.length;
  const sg = $("suggest"); sg.innerHTML = "";
  stock.forEach(i => {
    const c = el("button", "chip", "<b>+</b> "); c.type = "button";
    c.append(document.createTextNode(i.name));
    c.setAttribute("aria-label", "Remettre sur la liste : " + i.name);
    c.onclick = () => write(i.id, { status: "todo", addedBy: me, addedByEmail: myEmail });
    sg.append(c);
  });

  editBtn.textContent = editMode ? "Terminé" : "Gérer les rayons";
  for (const id of ["addForm", "typeahead", "suggestBox", "todo", "cartBox"]) { const e = $(id); if (e) e.style.display = editMode ? "none" : ""; }
  if (editMode) { $("count").textContent = ""; }
  const old = $("orderBox");
  // Ne pas reconstruire l'écran pendant qu'on tape un nom de rayon.
  if (old && editMode && old.contains(document.activeElement) && document.activeElement.tagName === "INPUT") { renderTypeahead(); return; }
  if (old) old.remove();
  if (editMode) renderManager();
  placeCardButton();
  renderTypeahead();
}

// --- Écran « Gérer les rayons » ---
function renderManager() {
  const box2 = el("section", "manager"); box2.id = "orderBox";
  const h = el("h2"); h.textContent = "Vos rayons"; box2.append(h);
  const p = el("p", "note"); p.style.margin = "-8px 2px 0";
  p.textContent = "Touchez un nom de rayon ou d'article pour le corriger. Les flèches rangent les rayons dans l'ordre du magasin. Le menu déplace un article, la poubelle le supprime.";
  box2.append(p);
  const all = items.slice().sort(byName);
  aisleOrder.forEach((id, i) => {
    const card = el("div", "aisle-card");
    const head = el("div", "aisle-head");
    const name = document.createElement("input");
    name.id = "aisle-name-" + id; name.value = aisleName(id); name.setAttribute("aria-label", "Nom du rayon");
    name.enterKeyHint = "done";
    name.addEventListener("change", () => renameAisle(id, name.value));
    name.addEventListener("keydown", e => { if (e.key === "Enter") name.blur(); });
    const up = el("button", null, "↑"); up.type = "button"; up.disabled = i === 0; up.setAttribute("aria-label", "Monter " + aisleName(id));
    const down = el("button", null, "↓"); down.type = "button"; down.disabled = i === aisleOrder.length - 1; down.setAttribute("aria-label", "Descendre " + aisleName(id));
    const move = d => { const o = aisleOrder.slice(); [o[i], o[i + d]] = [o[i + d], o[i]]; saveOrder(o); };
    up.onclick = () => move(-1); down.onclick = () => move(1);
    head.append(name, up, down);
    if (id !== UNKNOWN) {
      const del = el("button", null, BIN); del.type = "button"; del.setAttribute("aria-label", "Supprimer le rayon " + aisleName(id));
      del.onclick = () => { confirmDelete = confirmDelete === id ? null : id; render(); };
      head.append(del);
    }
    card.append(head);
    if (confirmDelete === id) {
      const c = el("div", "confirm");
      const t = el("span"); t.textContent = "Supprimer « " + aisleName(id) + " » ? Ses articles iront dans « " + aisleName(UNKNOWN) + " »."; c.append(t);
      const yes = el("button", "danger"); yes.type = "button"; yes.textContent = "Supprimer"; yes.onclick = () => deleteAisle(id);
      const no = el("button", "ghost"); no.type = "button"; no.textContent = "Annuler"; no.onclick = () => { confirmDelete = null; render(); };
      c.append(yes, no); card.append(c);
    }
    const ul = el("ul", "aisle-items");
    const these = all.filter(it => aisleOf(it) === id);
    if (!these.length) { const li = el("li", "none"); li.textContent = "Aucun article pour l'instant"; ul.append(li); }
    for (const it of these) {
      const li = el("li");
      // Le nom se corrige directement (faute de frappe), validé avec Entrée.
      const t = document.createElement("input"); t.className = "item-name"; t.id = "item-name-" + it.id;
      t.value = it.name; t.setAttribute("aria-label", "Nom de l'article"); t.enterKeyHint = "done";
      t.addEventListener("change", () => { const v = t.value.trim().replace(/\s+/g, " "); if (v && v !== it.name) write(it.id, { name: v.charAt(0).toUpperCase() + v.slice(1) }); else t.value = it.name; });
      t.addEventListener("keydown", e => { if (e.key === "Enter") t.blur(); });
      li.append(t);
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "Rayon de " + it.name);
      for (const a of aisleOrder) { const o = document.createElement("option"); o.value = a; o.textContent = aisleName(a); sel.append(o); }
      sel.value = id;
      sel.onchange = () => write(it.id, { aisle: sel.value });
      const del = el("button", "item-del", BIN); del.type = "button"; del.setAttribute("aria-label", "Supprimer l'article " + it.name); del.title = "Supprimer";
      del.onclick = () => remove(it.id);
      li.append(sel, del); ul.append(li);
    }
    card.append(ul);
    box2.append(card);
  });
  const addRow = el("form", "add"); addRow.autocomplete = "off";
  const newName = document.createElement("input"); newName.id = "newAisle"; newName.placeholder = "Nouveau rayon, ex. Bio"; newName.setAttribute("aria-label", "Nom du nouveau rayon");
  const addBtn = el("button", "btn"); addBtn.type = "submit"; addBtn.textContent = "Ajouter";
  addRow.append(newName, addBtn);
  addRow.addEventListener("submit", e => { e.preventDefault(); addAisle(newName.value); });
  box2.append(addRow);
  editBar.before(box2);
}

// Le bouton carte se place à côté de « Courses terminées » quand le panier n'est pas vide, sinon en bas avec les autres boutons.
function placeCardButton() {
  const cartShown = !$("cartBox").hidden && !editMode;
  const target = cartShown ? $("cartBox").querySelector(".actions") : editBar;
  if (cardBtn.parentElement !== target) { if (cartShown) target.append(cardBtn); else target.prepend(cardBtn); }
  cardBtn.hidden = editMode;
}

// --- Carte de fidélité (Supercard) ---
// La photo est réduite puis gardée dans Firebase, avec un document par personne : chacun a sa carte,
// et elle reste disponible hors ligne à la caisse grâce au cache local.
const CARD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M6 10v4M9 10v4M11.5 10v4M14 10v4M17.5 10v4"/></svg>';
const cardBtn = el("button", "ghost cardbtn", CARD_ICON + "<span>Afficher carte</span>");
cardBtn.type = "button"; cardBtn.id = "showCard";
placeCardButton();
const cardView = el("div", "card-view"); cardView.id = "cardView"; cardView.hidden = true;
cardView.setAttribute("role", "dialog"); cardView.setAttribute("aria-label", "Carte de fidélité");
document.body.append(cardView);
const cardFile = document.createElement("input");
cardFile.type = "file"; cardFile.accept = "image/*"; cardFile.id = "cardFile"; cardFile.hidden = true;
document.body.append(cardFile);
let wakeLock = null;

// Les cartes proposées. La Supercard garde l'identifiant de la première version (sans suffixe).
const CARD_TYPES = ["Supercard", "Manor"];
let currentCard = (() => { try { return localStorage.getItem("lastCard") || CARD_TYPES[0]; } catch (e) { return CARD_TYPES[0]; } })();
// Cartes communes au foyer : une seule photo par carte, visible par vous deux.
const cardId = label => "_carte_commune_" + norm(label).replace(/[^a-z0-9]/g, "");

cardBtn.onclick = async () => {
  cardOpen = true; renderCard(); cardView.hidden = false;
  try { wakeLock = await navigator.wakeLock.request("screen"); } catch (e) { wakeLock = null; }
};
function closeCard() {
  cardOpen = false; cardView.hidden = true;
  try { if (wakeLock) wakeLock.release(); } catch (e) {}
  wakeLock = null;
}
function renderCard() {
  cardView.innerHTML = "";
  const myCards = cards;
  if (!CARD_TYPES.includes(currentCard)) currentCard = CARD_TYPES[0];
  // Onglets pour passer d'une carte à l'autre.
  const tabs = el("div", "card-tabs");
  for (const label of CARD_TYPES) {
    const t = el("button", "card-tab" + (label === currentCard ? " on" : "")); t.type = "button"; t.textContent = label;
    t.setAttribute("aria-pressed", label === currentCard ? "true" : "false");
    t.onclick = () => { currentCard = label; try { localStorage.setItem("lastCard", label); } catch (e) {} renderCard(); };
    tabs.append(t);
  }
  cardView.append(tabs);
  const mine = myCards[currentCard];
  if (mine && mine.photo) {
    const img = document.createElement("img"); img.src = mine.photo; img.alt = "Photo de ma carte " + currentCard;
    const tip = el("p"); tip.textContent = "Montez la luminosité de l'écran au maximum pour que la caisse lise bien le code-barres.";
    cardView.append(img, tip);
  } else {
    const h = el("h2"); h.textContent = "Ajoutez votre carte " + currentCard;
    const tip = el("p"); tip.textContent = "Choisissez une photo de la carte dans votre galerie, avec le code-barres bien net et entièrement visible.";
    cardView.append(h, tip);
  }
  const actions = el("div", "actions");
  const pick = el("button", mine ? "ghost" : "btn"); pick.type = "button";
  pick.textContent = mine ? "Changer la photo" : "Choisir dans la galerie";
  pick.onclick = () => cardFile.click();
  const close = el("button", mine ? "btn" : "ghost"); close.type = "button"; close.textContent = "Fermer";
  close.onclick = closeCard;
  actions.append(pick, close);
  cardView.append(actions);
}
cardFile.addEventListener("change", async () => {
  const file = cardFile.files && cardFile.files[0];
  cardFile.value = "";
  if (!file || !col) return;
  try {
    const photo = await shrinkPhoto(file, 1100, 0.85);
    await setDoc(doc(col, cardId(currentCard)), { kind: "card", owner: myEmail, label: currentCard, photo, updatedAt: Date.now() });
  } catch (e) { setStatus("La photo n'a pas pu être enregistrée. (" + ((e && (e.code || e.message)) || "erreur") + ")", true); }
});
// Réduit la photo (côté le plus long : maxSide pixels) pour qu'elle tienne dans la base de données.
function shrinkPhoto(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL("image/jpeg", quality);
      if (out.length > 900000) out = c.toDataURL("image/jpeg", 0.6);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image illisible")); };
    img.src = url;
  });
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && cardOpen) closeCard(); });
window.addEventListener("popstate", () => { if (cardOpen) closeCard(); });

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
