# CareSync AI — Senior-First Elderly Care & Medication Management

> A front-end hackathon prototype for medication tracking, caregiver collaboration, accessibility, and appointment visibility.

**Live prototype:** https://nimble-mousse-04e6c5.netlify.app

## What works in this prototype

- Senior-friendly medication schedule with taken/pending status.
- Caregiver demo PIN gate (`123456`) and senior-controlled approval of proposed care-plan items.
- Medication status, caregiver proposals, activity log, and doctor appointments persist in the same browser using `localStorage`.
- Add doctor appointments with doctor, date, time, and clinic details; appointments appear in the senior view.
- English, Hindi, and Telugu interface text plus browser text-to-speech controls.
- Local demo escalation and SOS event logging.
- Basic automated tests for medication status, approval workflow, appointment creation, persistence, safe toast rendering, and demo-notification disclosures.

## Important prototype limitations

This is **not a production healthcare system** and must not be used to store real patient data or make clinical decisions.

- The demo PIN is hardcoded in client-side JavaScript. It is a demonstration gate, **not secure authentication**.
- `localStorage` is browser/device-local. It does not provide server-side storage, encrypted medical records, or multi-user synchronization.
- No email, SMS, push notification, emergency-service call, or automatic background reminder is configured. SOS and missed-dose actions are recorded locally for demonstration only.
- The medication guidance is general demonstration text, not medical advice. Users should follow their prescription and consult a qualified healthcare professional.
- Appointment entries are local demo records; no email appointment reminders are sent.

## Run locally

Requires Node.js 18 or newer for tests.

```bash
npm test
```

Open `index.html` in a browser or deploy the repository as a static site on Netlify.

## Security headers

Netlify response headers are configured in `netlify.toml` for frame protection, content-type sniffing protection, referrer policy, permissions policy, and HTTPS transport security.
