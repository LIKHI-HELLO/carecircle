const pad = n => String(n).padStart(2, '0');
const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const doseKey = (date, id, time) => `${date}|${id}|${time}`;
const active = (m, date) => m.status === 'active' && (!m.start || m.start <= date) && (!m.end || m.end >= date);
function dosesFor(meds, date) {
  return meds.filter(m => active(m, date)).flatMap(m => m.times.map(t => ({ id: m.id, name: m.name, dose: m.dose, time: t })))
    .sort((a, b) => a.time.localeCompare(b.time));
}
function adherence(meds, log, days, now = new Date()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    const date = dayKey(d), doses = dosesFor(meds, date);
    const taken = doses.filter(x => log[doseKey(date, x.id, x.time)]).length;
    out.push({ date, total: doses.length, taken, pct: doses.length ? Math.round(taken / doses.length * 100) : null });
  }
  return out;
}
const minutes = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
// Dose is "missed" once graceMin minutes have passed without being taken.
const isMissed = (time, now, graceMin = 60) => now.getHours() * 60 + now.getMinutes() > minutes(time) + graceMin;
module.exports = { dayKey, doseKey, dosesFor, adherence, isMissed };
