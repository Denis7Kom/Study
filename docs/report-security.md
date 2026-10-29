# Configurazione delle segnalazioni

La pagina usa la raccolta Firestore `reports` e richiede l'accesso Google.
Prima della pubblicazione, integra il seguente blocco dentro il blocco
`match /databases/{database}/documents` delle regole Firestore esistenti.
Non sostituire le regole già utilizzate per progressi e notifiche.

```
// The admin claim must be assigned with the Firebase Admin SDK.
match /reports/{reportId} {
  function signedIn() { return request.auth != null; }
  function admin() { return signedIn() && request.auth.token.admin == true; }
  allow create: if signedIn()
    && request.resource.data.keys().hasOnly(['userId', 'message', 'contact', 'status', 'createdAt', 'updatedAt'])
    && request.resource.data.keys().hasAll(['userId', 'message', 'contact', 'status', 'createdAt', 'updatedAt'])
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.message is string
    && request.resource.data.message.size() >= 10
    && request.resource.data.message.size() <= 1500
    && request.resource.data.contact is string
    && request.resource.data.contact.size() <= 200
    && request.resource.data.status == 'new'
    && request.resource.data.createdAt == request.time
    && request.resource.data.updatedAt == request.time;
  allow read: if signedIn() && (admin() || resource.data.userId == request.auth.uid);
  allow update: if admin()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'updatedAt'])
    && request.resource.data.status in ['new', 'rejected', 'resolved']
    && request.resource.data.updatedAt == request.time;
  allow delete: if false;
}
```

Assegna il custom claim `admin: true` all'UID Firebase dell'amministratore
con Firebase Admin SDK in un ambiente fidato. Non inserire credenziali nel repository.
Esempio con un'app Admin già inizializzata:

```js
const user = await getAuth().getUser(uid);
await getAuth().setCustomUserClaims(uid, { ...user.customClaims, admin: true });
```

L'amministratore deve uscire e rientrare oppure aggiornare il proprio token dopo
l'assegnazione. Verifica le regole esistenti: un'altra regola che consente
l'accesso alla stessa raccolta può prevalere, perché le autorizzazioni Firestore
sono additive. Verifica creazione, lettura del proprietario, accesso negato agli
altri utenti e modifica dello stato nel Firebase Emulator prima del rilascio.
La pagina di gestione è visibile solo agli account con il claim; la protezione
effettiva deve essere applicata dalle regole pubblicate.
