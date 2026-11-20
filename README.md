# AgendaSmart V5

Web app responsive per la gestione condivisa di un piccolo studio odontoiatrico. Il progetto è autonomo: server Node.js, database SQLite locale e interfaccia web senza dipendenze npm. WhatsApp e le risposte dei pazienti sono simulate; non viene contattato alcun numero.

## Requisiti e avvio

- Node.js 22.5 o successivo (usa il modulo SQLite integrato in Node).
- Nella cartella del progetto:

```sh
npm start
```

Apri `http://localhost:3000`. Per sviluppo con riavvio automatico usa `npm run dev`. Il database viene creato in `data/agendasmart.sqlite` al primo avvio. La porta si cambia con la variabile `PORT`.

### Accesso demo

- Utente: `segreteria`
- Password: `agenda2025!`
- Anche `admin` usa la password demo `agenda2025!`.

Per provare da un telefono sulla stessa rete Wi-Fi, apri nel browser Android `http://<IP-del-computer>:3000` e consenti le connessioni in ingresso nella rete privata, se richiesto. La sessione scade dopo 12 ore.

## Verifica manuale del flusso

1. Accedi e scegli il giorno con il selettore data.
2. Consulta l'agenda per professionista; crea un appuntamento usando la scheda in fondo. La API controlla abilitazione professionale, risorse della poltrona e sovrapposizioni.
3. Annulla un appuntamento dimostrativo futuro. Lo slot viene marcato libero e il sistema cerca appuntamenti successivi compatibili per durata, professionista e poltrona; genera una proposta simulata per ogni candidato.
4. In **Anticipi**, usa “Simula accettazione”: il cambio di stato resta in attesa.
5. Solo “Approva e sposta”, autenticato come segreteria, modifica data, professionista e poltrona dell'appuntamento. In questo modo l'orario precedente torna disponibile.
6. **Attività** mostra audit di accessi, appuntamenti, disdette, proposte, risposte e approvazioni.

Per iniziare con dati puliti, arresta il server ed elimina `data/agendasmart.sqlite` (e gli eventuali file `-wal` / `-shm`); al prossimo avvio il database demo viene ricreato. Il progetto non include una suite automatizzata.

## Dati e modello

Il seed genera 5 professionisti, 5 poltrone, 9 prestazioni con durate e fabbisogni risorsa, 12 pazienti fittizi e appuntamenti con date relative al primo avvio. Specialità, prestazioni abilitate e attrezzatura della poltrona governano la compatibilità. Le tabelle SQLite sono definite e inizializzate in `server.js`.

## Struttura per future integrazioni

- Sostituire il seed con un adattatore/import periodico verso il gestionale esistente, mappando identificativi esterni e mantenendo un livello d'idempotenza.
- Per un uso multi-dispositivo oltre la rete locale, portare SQLite a PostgreSQL e proteggere il servizio con TLS, credenziali individuali, gestione segreti e backup; non esporre il server demo a Internet.
- Separare il connettore WhatsApp Business Platform dal flusso appuntamenti: coda/outbox, template approvati, webhook firmati, consenso e registrazione dell'esito. Le proposte devono mantenere accettazione, approvazione e aggiornamento come passaggi distinti.
- Il prototipo usa un account dimostrativo condiviso e dati sanitari di esempio fittizi: prima dell'uso operativo servono gestione ruoli/utenti, credenziali sicure, privacy e conformità definite dallo studio.

API essenziali: `POST /api/login`, `GET /api/agenda`, `GET /api/catalog`, `POST /api/appointments`, `POST /api/appointments/:id/cancel`, `GET /api/proposals`, `POST /api/proposals/:id/{accept|decline|approve|reject}`, `GET /api/audit`. `GET /health` espone lo stato del processo senza autenticazione.

## Agenda giornaliera e settimanale

Nella scheda Agenda, usa i pulsanti Giorno/Settimana e le frecce per spostarti nel calendario. Puoi filtrare per professionista, poltrona e prestazione; il pulsante Oggi riporta al periodo corrente. La vista settimanale scorre orizzontalmente su schermi stretti.


## Gestione archivio, stanze e conferme

- **Clienti**, **Professionisti** e **Trattamenti** hanno moduli per aggiungere nuove schede. Nella scheda professionista si scelgono i trattamenti abilitati; in trattamento e stanza si indicano le risorse richieste/disponibili, usate dal controllo di compatibilità.
- **Stanze** mostra il numero attivo; se una stanza ha appuntamenti prenotati non può essere disattivata. Le stanze con storico vengono archiviate, così l'agenda passata resta leggibile.
- La routine dei promemoria si avvia insieme al server e controlla ogni 15 minuti gli appuntamenti a circa 24 ore (finestra 23–25 ore). Si può avviare anche dalla pagina **Promemoria** con “Prepara promemoria ora”.
- I testi vengono preparati nella coda con destinatario, link e codice monouso di 10 caratteri. Restano **Da inviare**: non è collegato alcun gateway e nessun WhatsApp/SMS viene spedito. La segreteria può copiare il testo.
- Per rendere raggiungibile il link su Internet, avvia il server impostando `PUBLIC_APP_URL` all'origine HTTPS pubblica dell'app. In locale i link funzionano sul computer che esegue il server; un cliente sul telefono deve raggiungere l'host via rete locale oppure un deployment HTTPS.
- Il cliente apre il link `/conferma?confirm=CODICE` oppure apre `/conferma` e inserisce il codice, vede prestazione, professionista, data e ora e può confermare o disdire. Il codice è monouso e scade tre ore dopo l'orario dell'appuntamento. La disdetta libera lo slot e avvia la ricerca di proposte compatibili.
- Endpoint principali nuovi: `POST /api/patients`, `POST /api/professionals`, `POST /api/procedures`, `POST /api/chairs`, `DELETE /api/chairs/:id`, `POST /api/reminders/run`, `GET /api/reminders`, `GET|POST /api/public/confirm`.

