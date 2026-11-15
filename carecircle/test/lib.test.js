const test = require('node:test'), assert = require('node:assert');
const { adherence, doseKey, isMissed, dosesFor } = require('../lib');
const meds = [{ id: 'a', name: 'Metformin', dose: '500mg', times: ['08:00', '20:00'], status: 'active' },
  { id: 'b', name: 'Pending', dose: '1', times: ['09:00'], status: 'pending' }];
test('pending meds are not scheduled', () => assert.equal(dosesFor(meds, '2026-11-15').length, 2));
test('adherence percentage', () => {
  const now = new Date(2026, 10, 15), log = { [doseKey('2026-11-15', 'a', '08:00')]: true };
  const r = adherence(meds, log, 1, now);
  assert.equal(r[0].pct, 50);
});
test('missed after grace period', () => {
  assert.equal(isMissed('08:00', new Date(2026, 10, 15, 8, 30)), false);
  assert.equal(isMissed('08:00', new Date(2026, 10, 15, 9, 30)), true);
});
