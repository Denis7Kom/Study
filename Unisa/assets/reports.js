import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const config = {apiKey:"AIzaSyAI8QZjC3qSNq33bNBk7Ls19bjanc4-QnQ",authDomain:"appunti-unisa.firebaseapp.com",projectId:"appunti-unisa",storageBucket:"appunti-unisa.firebasestorage.app",messagingSenderId:"682409351930",appId:"1:682409351930:web:728a3ba5a1d23ffe0a0743"};
const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app); auth.languageCode = "it";
const db = getFirestore(app);
const reports = collection(db, "reports");
const byId = id => document.getElementById(id);
const labels = {new:"Nuova",rejected:"Rifiutata",resolved:"Risolta"};
let user = null, unsubscribeMine = null, unsubscribeAll = null, generation = 0;
function notice(text, error = false) { const e = byId("notice"); e.textContent = text; e.className = error ? "report-error" : "report-note"; }
function make(tag, text, className) { const e = document.createElement(tag); e.textContent = text; if (className) e.className = className; return e; }
function render(target, snapshot, admin) {
  target.replaceChildren();
  const items = snapshot.docs.map(d => ({id:d.id,...d.data()})).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
  if (!items.length) { target.append(make("p", "Nessuna segnalazione.", "report-note")); return; }
  for (const item of items) {
    const card = make("article", "", "report-item"), head = make("div", "", "report-head");
    const date = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("it-IT") : "Invio in corso";
    head.append(make("time", date), make("span", labels[item.status] || "Stato sconosciuto", "report-status " + (labels[item.status] ? item.status : "")));
    card.append(head, make("p", item.message || ""));
    if (item.contact) card.append(make("p", "Contatto: " + item.contact, "report-note"));
    if (admin) {
      card.append(make("p", "ID utente: " + item.userId, "report-note"));
      const label = make("label", "Modifica stato: ");
      const select = document.createElement("select");
      for (const [value, text] of Object.entries(labels)) { const option = make("option", text); option.value = value; select.append(option); }
      select.value = item.status;
      select.addEventListener("change", async () => {
        select.disabled = true;
        try { await updateDoc(doc(db, "reports", item.id), {status:select.value, updatedAt:serverTimestamp()}); notice("Stato aggiornato."); }
        catch (e) { select.value = item.status; notice("Impossibile aggiornare lo stato. Controlla la connessione e i permessi.", true); }
        finally { select.disabled = false; }
      });
      label.append(select); card.append(label);
    }
    target.append(card);
  }
}
byId("login").addEventListener("click", async () => {
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  catch (e) { notice("Accesso non riuscito. Controlla la connessione e riprova.", true); }
});
byId("report-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!user) return;
  const message = byId("message").value.trim(), contact = byId("contact").value.trim();
  if (message.length < 10) { notice("Scrivi almeno 10 caratteri per descrivere il problema.", true); return; }
  const button = event.currentTarget.querySelector("button"); button.disabled = true;
  try {
    await addDoc(reports, {userId:user.uid, message, contact, status:"new", createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
    event.target.reset(); notice("Segnalazione inviata.");
  } catch (e) { notice("Invio non riuscito. Controlla la connessione e riprova.", true); }
  finally { button.disabled = false; }
});
onAuthStateChanged(auth, async current => {
  const token = ++generation;
  if (unsubscribeMine) unsubscribeMine(); if (unsubscribeAll) unsubscribeAll();
  unsubscribeMine = unsubscribeAll = null; user = current;
  byId("mine").replaceChildren(); byId("all").replaceChildren();
  byId("login-panel").hidden = !!current; byId("form-panel").hidden = !current; byId("mine-panel").hidden = !current; byId("admin-panel").hidden = true;
  notice("");
  if (!current) return;
  unsubscribeMine = onSnapshot(query(reports, where("userId","==",current.uid)), snap => render(byId("mine"), snap, false), () => notice("Impossibile caricare le tue segnalazioni.", true));
  try {
    const result = await current.getIdTokenResult();
    if (token !== generation || !result.claims.admin) return;
    byId("admin-panel").hidden = false;
    unsubscribeAll = onSnapshot(reports, snap => render(byId("all"), snap, true), () => notice("Impossibile caricare le segnalazioni per la gestione.", true));
  } catch (e) { if (token === generation) notice("Impossibile verificare i permessi dell'account.", true); }
});