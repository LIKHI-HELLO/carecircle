const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(inlineScript, 'the application must contain its inline JavaScript');

function makeClassList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    contains: item => values.has(item),
  };
}

function makeElement() {
  return {
    value: '', innerText: '', innerHTML: '', textContent: '', className: '',
    children: [], classList: makeClassList(),
    appendChild(child) { this.children.push(child); return child; },
    remove() { this.removed = true; },
  };
}

function createApp(storage = new Map()) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement() { return makeElement(); },
  };
  const localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
  };
  const window = {
    localStorage,
    addEventListener() {},
    speechSynthesis: { cancel() {}, speak() {} },
  };
  const context = {
    window, document, console, Date, JSON, Math, Number, String, Array, Object,
    setTimeout() { return 1; }, setInterval() { return 1; }, clearInterval() {},
    SpeechSynthesisUtterance: function (text) { this.text = text; },
  };
  vm.createContext(context);
  vm.runInContext(`${inlineScript[1]}\n;globalThis.__api = {\n` +
    'getState: () => state, restoreDemoState, persistDemoState, toggleMedStatus, ' +
    'proposeCaregiverChange, approveCaregiverChange, simulateMissedDoseAlert, ' +
    'confirmSOSCall, resetDemoData, verifyPasscode, showToast, askAI, addAppointment\n};', context);
  return { api: context.__api, elements, storage, getElement: document.getElementById };
}

test('renders a real medication state model with three sample medicines', () => {
  const app = createApp();
  const state = app.api.getState();
  assert.equal(state.medications.length, 3);
  assert.ok(state.medications.every(m => m.name && m.time && ['taken', 'pending'].includes(m.status)));
});

test('toggling a dose changes the actual record, adds an audit log, and persists it', () => {
  const app = createApp();
  const before = app.api.getState().medications[1].status;
  app.api.toggleMedStatus(2);
  const state = app.api.getState();
  assert.equal(state.medications[1].status, before === 'taken' ? 'pending' : 'taken');
  assert.match(state.logs[0].text, /Telmisartan/);
  assert.ok(app.storage.has('caresync-demo-state-v1'));
});

test('caregiver cannot propose an item when required fields are missing', () => {
  const app = createApp();
  app.api.proposeCaregiverChange();
  assert.equal(app.api.getState().pendingChange, null);
  assert.equal(app.api.getState().medications.length, 3);
});

test('caregiver proposal remains pending until senior approval', () => {
  const app = createApp();
  app.getElement('new-med-name').value = '';
  app.getElement('new-med-time').value = '';
  app.api.proposeCaregiverChange();
  // Supply values through the mocked DOM and propose again.
  app.getElement('new-med-name').value = 'Vitamin D3';
  app.getElement('new-med-time').value = '2:00 PM';
  app.api.proposeCaregiverChange();
  assert.equal(app.api.getState().medications.length, 3);
  assert.match(app.api.getState().pendingChange.text, /Vitamin D3/);
  app.api.approveCaregiverChange(true);
  assert.equal(app.api.getState().medications.length, 4);
  assert.equal(app.api.getState().pendingChange, null);
  assert.equal(app.api.getState().medications[3].name, 'Vitamin D3');
});

test('declining a caregiver proposal does not add a medication', () => {
  const app = createApp();
  app.getElement('new-med-name');
  app.getElement('new-med-time');
  app.getElement('new-med-name').value = 'Unapproved item';
  app.getElement('new-med-time').value = '3:00 PM';
  app.api.proposeCaregiverChange();
  app.api.approveCaregiverChange(false);
  assert.equal(app.api.getState().medications.length, 3);
  assert.equal(app.api.getState().pendingChange, null);
});

test('missed-dose demo records a local event without falsely claiming an SMS was sent', () => {
  const app = createApp();
  app.api.simulateMissedDoseAlert();
  const message = app.api.getState().logs[0].text;
  assert.match(message, /DEMO ESCALATION/);
  assert.match(message, /no SMS\/email was sent/i);
});

test('SOS confirmation is transparent that no external call or message is sent', () => {
  const app = createApp();
  app.api.confirmSOSCall();
  assert.match(app.api.getState().logs[0].text, /No call, SMS, or push notification was sent/);
});

test('state survives a reload in the same browser using local demo storage', () => {
  const storage = new Map();
  const first = createApp(storage);
  first.api.toggleMedStatus(2);
  const expected = first.api.getState().medications[1].status;
  const second = createApp(storage);
  second.api.restoreDemoState();
  assert.equal(second.api.getState().medications[1].status, expected);
});

test('toast messages are inserted as text, not interpreted as HTML', () => {
  const app = createApp();
  app.api.showToast('<img src=x onerror=alert(1)>');
  const toast = app.elements.get('toast-container').children[0];
  assert.equal(toast.children[1].textContent, '<img src=x onerror=alert(1)>');
});

test('caregiver inputs have accessible names and emergency screen discloses demo limits', () => {
  assert.match(html, /aria-label="Medication or activity name"/);
  assert.match(html, /aria-label="Medication or activity time"/);
  assert.match(html, /does not call emergency services or send SMS\/push notifications/);
});


test('caregiver can add a valid doctor appointment and it is persisted', () => {
  const app = createApp();
  app.getElement('appointment-doctor').value = 'Dr. Test';
  app.getElement('appointment-date').value = '2026-12-01';
  app.getElement('appointment-time').value = '11:15';
  app.getElement('appointment-location').value = 'Test Clinic';
  app.api.addAppointment();
  const appointment = app.api.getState().appointments.at(-1);
  assert.equal(appointment.doctor, 'Dr. Test');
  assert.equal(appointment.date, '2026-12-01');
  assert.ok(app.storage.has('caresync-demo-state-v1'));
});

test('appointment form rejects incomplete records', () => {
  const app = createApp();
  app.getElement('appointment-doctor').value = 'Dr. Missing';
  app.api.addAppointment();
  assert.equal(app.api.getState().appointments.length, 1);
});
