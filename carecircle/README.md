# CareCircle – Elderly Care & Medication Management

A shared care plan for an elderly person, their caretakers and family, with the elder in control.

| Requirement | Where |
|---|---|
| Passcode-based shared access | `POST /api/profiles`, `/api/login` (bcrypt, rate-limited) |
| Medication schedules (view/add/edit/manage) | `/api/meds`, Medicines section |
| Adherence tracking | `lib.js` `adherence()`, 7-day chart, "I took it" |
| Doctor appointments | `/api/appts` |
| Proactive email reminders | `POST /api/cron/reminders` (due, missed, appointment) |
| Beyond reminders | Missed-dose escalation to family; elder approval of changes by others; elder-first large-text UI |

## Run
```
npm install && npm test && npm start
```
Env vars: see `.env.example` (`CRON_SECRET`, `SMTP_URL`, `MAIL_FROM`). Without `SMTP_URL`, emails are logged.

## Deploy to Cloud Run
```
gcloud run deploy carecircle --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars CRON_SECRET=...,SMTP_URL=...,MAIL_FROM=...
```
Then create a Cloud Scheduler job (every 5 minutes) that POSTs to `/api/cron/reminders` with header `x-cron-secret`.

Note: data is stored in a JSON file, which Cloud Run resets on restart. For production, swap `db` in `server.js` for Firestore.
