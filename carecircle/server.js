const express = require('express'), bcrypt = require('bcryptjs'), crypto = require('crypto'), fs = require('fs'), path = require('path');
const nodemailer = require('nodemailer');
const { dayKey, doseKey, dosesFor, adherence, isMissed } = require('./lib');
const app = express(); app.use(express.json({ limit: '50kb' })); app.use(express.static(path.join(__dirname, 'public')));
const FILE = path.join(__dirname, 'data', 'db.json');
let db = { profiles: {} };
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
const save = () => { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); };
const mailer = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
async function mail(to, subject, text) {
  if (!to.length) return;
  if (!mailer) return console.log('[email skipped, set SMTP_URL]', to.join(','), subject);
  await mailer.sendMail({ from: process.env.MAIL_FROM, to: to.join(','), subject, text }).catch(e => console.error(e.message));
}
const id = () => crypto.randomBytes(4).toString('hex');
const sessions = {}, attempts = {};
const clean = (s, n = 80) => String(s || '').trim().slice(0, n);
const valid = (a, b) => /^\d{2}:\d{2}$/.test(a) && b;

app.post('/api/profiles', async (req, res) => {
  const name = clean(req.body.name), pass = String(req.body.passcode || '');
  if (!name || pass.length < 4) return res.status(400).json({ error: 'Enter a name and a passcode of at least 4 characters.' });
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  db.profiles[code] = { name, hash: await bcrypt.hash(pass, 10), emails: [clean(req.body.email, 120)].filter(Boolean), meds: [], appts: [], log: {}, sent: {} };
  save(); res.json({ code });
});
app.post('/api/login', async (req, res) => {
  const code = clean(req.body.code).toUpperCase(), p = db.profiles[code], k = req.ip + code;
  if ((attempts[k] || 0) >= 5) return res.status(429).json({ error: 'Too many attempts. Wait 15 minutes.' });
  if (!p || !(await bcrypt.compare(String(req.body.passcode || ''), p.hash))) {
    attempts[k] = (attempts[k] || 0) + 1; setTimeout(() => delete attempts[k], 15 * 60000).unref();
    return res.status(401).json({ error: 'Wrong code or passcode.' });
  }
  const role = ['elder', 'caretaker', 'family'].includes(req.body.role) ? req.body.role : 'family';
  const token = crypto.randomBytes(16).toString('hex'); sessions[token] = { code, role, who: clean(req.body.who, 40) || role };
  res.json({ token, role });
});
const auth = (req, res, next) => {
  const s = sessions[req.get('x-token')]; if (!s) return res.status(401).json({ error: 'Please sign in.' });
  req.s = s; req.p = db.profiles[s.code]; next();
};
const view = (p, s) => ({ name: p.name, role: s.role, emails: p.emails, meds: p.meds, appts: p.appts,
  today: dosesFor(p.meds, dayKey(new Date())).map(d => ({ ...d, taken: !!p.log[doseKey(dayKey(new Date()), d.id, d.time)], missed: isMissed(d.time, new Date()) })),
  trend: adherence(p.meds, p.log, 7) });
app.get('/api/data', auth, (req, res) => res.json(view(req.p, req.s)));
app.post('/api/meds', auth, (req, res) => {
  const times = (req.body.times || []).filter(t => /^\d{2}:\d{2}$/.test(t)), name = clean(req.body.name);
  if (!name || !times.length) return res.status(400).json({ error: 'Add a medicine name and at least one time.' });
  // Elder stays in control: changes from family or caretakers wait for the elder's approval.
  req.p.meds.push({ id: id(), name, dose: clean(req.body.dose, 40), times, status: req.s.role === 'elder' ? 'active' : 'pending', by: req.s.who });
  save(); res.json(view(req.p, req.s));
});
app.post('/api/meds/:id/:act', auth, (req, res) => {
  const m = req.p.meds.find(x => x.id === req.params.id); if (!m) return res.status(404).json({ error: 'Not found.' });
  if (req.params.act === 'approve') { if (req.s.role !== 'elder') return res.status(403).json({ error: 'Only the elder can approve.' }); m.status = 'active'; }
  else if (req.params.act === 'delete') { if (req.s.role !== 'elder' && m.status === 'active') return res.status(403).json({ error: 'Ask the elder to remove active medicines.' }); req.p.meds = req.p.meds.filter(x => x !== m); }
  save(); res.json(view(req.p, req.s));
});
app.post('/api/take', auth, (req, res) => {
  req.p.log[doseKey(dayKey(new Date()), clean(req.body.id), clean(req.body.time))] = true; save(); res.json(view(req.p, req.s));
});
app.post('/api/appts', auth, (req, res) => {
  const t = clean(req.body.title); if (!t || !req.body.when) return res.status(400).json({ error: 'Add a title and date/time.' });
  req.p.appts.push({ id: id(), title: t, when: clean(req.body.when, 20), place: clean(req.body.place) }); save(); res.json(view(req.p, req.s));
});
app.delete('/api/appts/:id', auth, (req, res) => { req.p.appts = req.p.appts.filter(a => a.id !== req.params.id); save(); res.json(view(req.p, req.s)); });
app.post('/api/contacts', auth, (req, res) => {
  const e = clean(req.body.email, 120); if (/^\S+@\S+\.\S+$/.test(e) && !req.p.emails.includes(e)) req.p.emails.push(e); save(); res.json(view(req.p, req.s));
});
// Call every 5-10 minutes from Cloud Scheduler with header x-cron-secret.
app.post('/api/cron/reminders', async (req, res) => {
  if (!process.env.CRON_SECRET || req.get('x-cron-secret') !== process.env.CRON_SECRET) return res.sendStatus(403);
  const now = new Date(), today = dayKey(now); let sent = 0;
  for (const p of Object.values(db.profiles)) {
    for (const d of dosesFor(p.meds, today)) {
      const k = doseKey(today, d.id, d.time); if (p.log[k]) continue;
      const mins = now.getHours() * 60 + now.getMinutes() - (+d.time.slice(0, 2) * 60 + +d.time.slice(3));
      if (mins >= 0 && mins < 60 && !p.sent[k + 'due']) { p.sent[k + 'due'] = 1; sent++; await mail(p.emails, `Time for ${d.name}`, `${p.name}: ${d.name} ${d.dose} is due at ${d.time}.`); }
      if (isMissed(d.time, now) && !p.sent[k + 'missed']) { p.sent[k + 'missed'] = 1; sent++; await mail(p.emails, `Missed dose: ${d.name}`, `${p.name} has not marked ${d.name} (${d.time}) as taken. Please check in.`); }
    }
    for (const a of p.appts) { const diff = new Date(a.when) - now; if (diff > 0 && diff < 24 * 3600e3 && !p.sent[a.id]) { p.sent[a.id] = 1; sent++; await mail(p.emails, `Appointment: ${a.title}`, `${p.name} has "${a.title}" at ${a.when} ${a.place}.`); } }
  }
  save(); res.json({ sent });
});
if (require.main === module) app.listen(process.env.PORT || 8080, () => console.log('CareCircle running'));
module.exports = app;
