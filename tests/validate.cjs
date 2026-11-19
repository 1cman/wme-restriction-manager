'use strict';
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const file = path.join(__dirname, '..', 'dist', 'Restriction_Manager.user.js');
const source = fs.readFileSync(file, 'utf8');
const version = /^\/\/ @version\s+(\S+)/m.exec(source)?.[1];
assert.match(version || '', /^\d+\.\d+\.\d+$/);
assert.ok(source.includes(`const SCRIPT_VERSION = "${version}";`), 'Header and runtime versions must match.');
assert.ok(source.includes('<div class="rm-version-chip">v${SCRIPT_VERSION}</div>'),
  'Sidebar version badge must use SCRIPT_VERSION dynamically.');
assert.ok(!/<div class="rm-version-chip">v\d+\.\d+\.\d+<\/div>/.test(source),
  'Sidebar version badge must never hardcode a version.');
assert.match(source, /@grant\s+GM_xmlhttpRequest/);
assert.match(source, /@grant\s+unsafeWindow/);
assert.match(source, /@connect\s+nagerholidays\.com/);
assert.match(source, /MAINTENANCE_TRANSLATIONS/);
assert.match(source, /DIAG_MAX = 80/);
assert.match(source, /internalMotorApi/);
assert.ok(!source.includes('log("Preset salvato", name, preset)'), 'Raw presets must not be logged.');
new vm.Script(source, {filename: 'Restriction_Manager.user.js'});
// Test isolated maintenance logic without launching WME or touching the map.
const testingSource = source.replace(/\n    start\(\);\n\}\)\(\);\s*$/, `
    globalThis.__rmTest = {
      setSdk(value) { sdk = value; }, inspectSdkCompatibility,
      recordDiagnostic, getLog() { return diagnostics; }, clearDiagnostics,
      setLanguage(value) { currentLanguage = value; },
      translate(value) { return t(value); }
    };
})();`);
assert.notEqual(testingSource, source, 'Could not isolate startup.');
const store = new Map();
const fakeLocalStorage = {
  getItem(k) { return store.has(k) ? store.get(k) : null; },
  setItem(k, value) { store.set(k, String(value)); },
  removeItem(k) { store.delete(k); },
};
const rawWindow = { W: { model: { segments: {getObjectById() {}}, actionManager: {add() {}} } } };
const sandbox = {
  window: rawWindow, unsafeWindow: rawWindow, localStorage: fakeLocalStorage,
  console: {log() {}, error() {}, warn() {}},
  Date, JSON, Object, Array, Set, Map, String, Number, Math,
};
vm.runInNewContext(testingSource, sandbox, {timeout:5000});
const a = sandbox.__rmTest;
assert.ok(a);
const sdk = {
  Sidebar:{registerScriptTab() {}}, Editing:{getSelection() {}, undo() {}},
  DataModel:{Segments:{getById() {},updateSegment() {}}},
  Settings:{getLocale() {}},
  getSDKVersion() {return '1.2.3';},
  getWMEVersion() {return 'test-front';},
  isBetaEnvironment() {return true;},
};
a.setSdk(sdk);
let report = a.inspectSdkCompatibility();
assert.equal(report.ready, true);
assert.equal(report.environment, 'Beta');
assert.equal(report.sdkVersion, '1.2.3');
assert.equal(report.internalMotorApi, true);
assert.equal(report.missing.length, 0);
sdk.DataModel.Segments.updateSegment = undefined;
report = a.inspectSdkCompatibility();
assert.equal(report.ready, false);
assert.ok(report.missing.includes('DataModel.Segments.updateSegment'));
sdk.DataModel.Segments.updateSegment = () => {};
for (const lang of ['it','en','fr','es','de','pt']) {
  a.setLanguage(lang);
  const title = a.translate('Controllo compatibilità SDK');
  assert.ok(title && title !== 'Controllo compatibilità SDK' || lang === 'it');
}
a.recordDiagnostic('info', 'preset-saved', {restrictions:3, name:'PRIVATE-PRESET', segmentId:123, latitude:45.5});
const last = a.getLog().at(-1);
assert.equal(last.counters.restrictions, 3);
assert.equal(last.counters.name, undefined);
assert.equal(last.counters.segmentId, undefined);
assert.equal(last.counters.latitude, undefined);
for (let i=0;i<150;i++) a.recordDiagnostic('info','preview-ready',{segments:i});
assert.equal(a.getLog().length, 80);
assert.ok(!store.get('rm-maintenance-diagnostics:v1').includes('PRIVATE-PRESET'));
a.clearDiagnostics();
assert.equal(a.getLog().length, 0);
assert.equal(store.get('rm-maintenance-diagnostics:v1'), undefined);
// Regression: async SDK getters return Promises, not immediate strings.
sdk.getSDKVersion = () => Promise.resolve('2.230');
sdk.getWMEVersion = () => Promise.resolve('frontend-beta');
sdk.isBetaEnvironment = () => Promise.resolve(true);
const asyncReport = a.inspectSdkCompatibility();
assert.equal(asyncReport.ready, true);
new Promise(resolve => setImmediate(resolve)).then(() => {
  assert.equal(asyncReport.sdkVersion, '2.230');
  assert.equal(asyncReport.wmeVersion, 'frontend-beta');
  assert.equal(asyncReport.environment, 'Beta');
  sdk.getSDKVersion = () => Promise.reject(new Error('metadata failure'));
  sdk.getWMEVersion = () => Promise.resolve('frontend-production');
  sdk.isBetaEnvironment = () => Promise.resolve(false);
  const withFailure = a.inspectSdkCompatibility();
  assert.equal(withFailure.ready, true);
  return new Promise(resolve => setImmediate(resolve)).then(() => {
    assert.equal(withFailure.sdkVersion, 'n/a');
    assert.equal(withFailure.wmeVersion, 'frontend-production');
    assert.equal(withFailure.environment, 'Standard');
    console.log(`PASS: source syntax, sync+async SDK metadata, 6 languages, bounded and redacted diagnostic log — v${version}`);
  });
}).catch(err => { console.error(err); process.exitCode = 1; });
