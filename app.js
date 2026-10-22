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
const VERSION = "v8";
// Document spécial (dans la même collection) qui garde les réglages communs, comme l'ordre des rayons.
const SETTINGS_ID = "_reglages";
// Couleur de chaque personne : vert pour Mattia, bleu clair pour Francesca.
const PERSON_CLASS = { "kaanordagda5@gmail.com": "p-green", "francesca.jardini@gmail.com": "p-blue" };
const NAME_CLASS = { mattia: "p-green", ma: "p-green", francesca: "p-blue" };

// Les couleurs sont posées ici plutôt que dans index.html, pour qu'elles arrivent avec ce fichier
// même si le téléphone a gardé une ancienne page en mémoire.
const personStyle = document.createElement("style");
personStyle.textContent = `
  :root { --green-soft: #e3f3e7; --blue-soft: #e1f0fc; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --green-soft: #1d3324; --blue-soft: #1a2c3a; } }
  :root[data-theme="dark"] { --green-soft: #1d3324; --blue-soft: #1a2c3a; }
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
`;
document.head.append(personStyle);

// Rayon deviné à partir du nom, pour suivre l'ordre du magasin.
const AISLES = [
  ["Fruits et légumes", "pomme banane poire orange citron fraise raisin tomate salade carotte oignon ail patate courgette poivron concombre avocat champignon herbe persil basilic legume fruit kiwi melon poireau epinard"],
  ["Frais", "lait beurre yaourt yogourt fromage creme oeuf jambon poulet viande steak poisson saumon lardon emmental mozzarella parmesan dessert"],
  ["Pain", "pain baguette brioche croissant"],
  ["Épicerie", "pate riz farine sucre sel poivre huile vinaigre cafe the chocolat cereale biscuit confiture miel conserve sauce moutarde ketchup mayonnaise lentille semoule"],
  ["Boissons", "eau jus soda biere vin coca sirop"],
  ["Surgelés", "surgele glace frite pizza"],
  ["Maison et hygiène", "papier essuie lessive vaisselle eponge savon shampoing dentifrice brosse couche poubelle mouchoir douche deodorant"],
];
const DEFAULT_ORDER = AISLES.map(a => a[0]).concat(["Divers"]);
let aisleOrder = DEFAULT_ORDER.slice();
const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
function guessAisle(name) {
  const words = norm(name).split(/[^a-z]+/);
  for (const [aisle, list] of AISLES) {
    const keys = list.split(" ");
    if (words.some(w => keys.some(k => w === k || w === k + "s" || w === k + "x"))) return aisle;
  }
  return "Divers";
}

const STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
const STAR_ON = STAR.replace('fill="none"', 'fill="currentColor"');
const MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
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
    aisleOrder = mergeOrder(settings && settings.aisleOrder);
    items = all.filter(d => d.id !== SETTINGS_ID && d.kind !== "settings");
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
  addDoc(col, { name: nice, aisle: guessAisle(nice), status: "todo", staple: false, addedBy: me, addedByEmail: myEmail, createdAt: Date.now() }).catch(failed);
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
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new Recognition();
    rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onstart = () => { mic.classList.add("listening"); setStatus("Je vous écoute… dites par exemple « pâtes, tomates et parmesan »."); };
    rec.onresult = e => {
      const said = e.results[0][0].transcript;
      const names = said.split(/,|\bet\b|\bpuis\b|\bensuite\b/i).map(x => x.trim()).filter(Boolean);
      names.forEach(addName);
      setStatus(names.length ? "Ajouté : " + names.join(", ") : "");
    };
    rec.onerror = e => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") setStatus("Le micro est bloqué. Autorisez-le pour ce site dans les réglages de Chrome.", true);
      else if (e.error === "no-speech") setStatus("Je n'ai rien entendu. Touchez le micro et réessayez.");
      else setStatus("La dictée n'a pas marché (" + e.error + ").", true);
    };
    rec.onend = () => { mic.classList.remove("listening"); rec = null; };
    try { rec.start(); } catch (e) { rec = null; }
  };
}

// --- Rayons : changer le rayon d'un article et l'ordre des rayons ---
function mergeOrder(saved) {
  const list = Array.isArray(saved) ? saved.filter(a => DEFAULT_ORDER.includes(a)) : [];
  return list.concat(DEFAULT_ORDER.filter(a => !list.includes(a)));
}
function saveOrder(order) {
  aisleOrder = order;
  render();
  setDoc(doc(col, SETTINGS_ID), { kind: "settings", aisleOrder: order }).catch(failed);
}
const editBar = el("div", "editbar");
const editBtn = el("button", "ghost"); editBtn.type = "button"; editBtn.id = "editAisles";
editBar.append(editBtn);
$("main").querySelector(".who").before(editBar);
editBtn.onclick = () => { editMode = !editMode; render(); };

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
  if (editMode) {
    const sel = el("select", "aisle-select");
    sel.setAttribute("aria-label", "Rayon de " + it.name);
    for (const a of aisleOrder) { const o = document.createElement("option"); o.value = a; o.textContent = a; sel.append(o); }
    sel.value = it.aisle || "Divers";
    sel.onchange = () => write(it.id, { aisle: sel.value });
    li.append(sel);
    return li;
  }
  const star = el("button", "icon", it.staple ? STAR_ON : STAR);
  star.type = "button"; star.setAttribute("aria-pressed", it.staple ? "true" : "false");
  star.setAttribute("aria-label", "Article essentiel : " + it.name);
  star.title = it.staple ? "Essentiel (revient après les courses)" : "Marquer comme essentiel";
  star.onclick = () => write(it.id, { staple: !it.staple });
  li.append(star);
  const del = el("button", "icon", BIN);
  del.type = "button"; del.setAttribute("aria-label", "Supprimer : " + it.name); del.title = "Supprimer";
  del.onclick = () => remove(it.id);
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
      const these = todo.filter(i => (i.aisle || "Divers") === aisle).sort(byName);
      if (!these.length) continue;
      const g = el("div", "group");
      const h = el("h2"); h.textContent = aisle; g.append(h);
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

  editBtn.textContent = editMode ? "Terminé" : "Ranger les rayons";
  const old = $("orderBox"); if (old) old.remove();
  if (editMode) {
    const box2 = el("section"); box2.id = "orderBox"; box2.style.marginTop = "22px";
    const h = el("h2"); h.textContent = "Ordre des rayons dans votre magasin"; box2.append(h);
    const p = el("p", "note"); p.textContent = "Choisissez le rayon de chaque article dans la liste au-dessus, et rangez les rayons ici dans l'ordre où vous les traversez."; box2.append(p);
    const ul = el("ul", "order"); ul.style.marginTop = "8px";
    aisleOrder.forEach((a, i) => {
      const li = el("li"); const t = el("span"); t.textContent = a; li.append(t);
      const up = el("button", null, "↑"); up.type = "button"; up.disabled = i === 0; up.setAttribute("aria-label", "Monter " + a);
      const down = el("button", null, "↓"); down.type = "button"; down.disabled = i === aisleOrder.length - 1; down.setAttribute("aria-label", "Descendre " + a);
      const move = d => { const o = aisleOrder.slice(); [o[i], o[i + d]] = [o[i + d], o[i]]; saveOrder(o); };
      up.onclick = () => move(-1); down.onclick = () => move(1);
      li.append(up, down); ul.append(li);
    });
    box2.append(ul);
    editBar.before(box2);
  }
  renderTypeahead();
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
