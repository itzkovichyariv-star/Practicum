#!/usr/bin/env node
/* End-to-end smoke test in a real browser.
   Loads index.html in test mode, seeds data, drives the actual UI, and asserts:
     - no script errors
     - production storage keys are never written
     - no message is ever sent
     - existing student status survives a conversion untouched

   Run: node test/smoke.js
*/
const path = require('path');
const { chromium } = require('@playwright/test');

const FILE_URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?test=1';

const SEED = {
  courses: [{ id: 'hr-practicum', name: 'פרקטיקום משאבי אנוש', requireCV: true, requireApplication: true, requireInterview: true, requirePrep: true }],
  academicYears: ['תשפ״ו'],
  currentCourse: 'hr-practicum',
  currentYear: 'תשפ״ו',
  candidates: [
    { id: 1, name: 'דנה כהן', phone: '052-1234567', email: 'dana@example.com', city: 'פתח תקווה',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: '2026-01-14', interviewDate: '2026-02-03',
      interviewResult: 'passed', interviewSummary: 'מוטיבציה גבוהה, ניסיון קודם בגיוס.',
      evalCommitment: 'גבוה', evalMotivation: 'גבוה', evalCommunication: 'בינוני',
      evalEnglish: 'גבוה', evalAcquaintance: 'נמוך', evalScore: 88, preferredArea: 'גיוס ומיון',
      acceptedDate: '2026-02-03', status: 'accepted', notes: 'מעדיפה שני ורביעי',
      file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/hr/קורות_חיים' } },
    { id: 2, name: 'יוסי לוי', phone: '053-7654321', email: 'yossi@example.com',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: '2026-01-20', interviewDate: '2026-02-10',
      interviewResult: 'passed', interviewSummary: 'מתאים.', evalScore: 79, status: 'accepted', notes: '' },
    { id: 3, name: 'מאיה בר', phone: '054-1112222', email: 'maya@example.com',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: '2026-02-01', status: 'docs_ready', notes: '' }
  ],
  students: [
    { id: 10, name: 'דנה כהן', phone: '0521234567', email: 'DANA@example.com', city: 'פתח תקווה',
      courseId: 'hr-practicum', year: 'תשפ״ו', prepDone: true, prepDate: '2026-03-01',
      acceptedOrg: 'מעוף', interviews: 2, hired: false, preferences: ['מעוף', 'נישה פרו', ''],
      submitted: ['מעוף', 'נישה פרו'], hoursReported: 60, hoursApproved: 55, hoursConfirmed: true,
      orgFeedback: 'מצוינת', file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/hr/קורות_חיים' },
      cvUrl: 'https://sharepoint.example/share/abc123', notes: 'ותיקה' }
  ],
  employers: [], communications: [], lectures: [], calendarEvents: [],
  settings: { basePath: '', senderEmail: 'x@y.z', senderName: 'בודק', yearDates: {}, holidayCache: {} },
  currentUser: { name: 'בודק אוטומטי', email: 'test@example.com' },
  version: '5.1'
};

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  else { fail++; console.log('  \x1b[31m✗\x1b[0m ' + name + (extra ? '\n      ' + extra : '')); }
}

(async () => {
  // The sandbox ships a pinned Chromium; use it rather than downloading one.
  const fs = require('fs');
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome'
  ];
  const exe = candidates.find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage();

  // Real script faults vs. this sandbox having no outbound network. The Supabase
  // CDN tag cannot load here; test mode never uses it, so it is noted not failed.
  const errors = [];
  const networkNotes = [];
  const isEnvNetwork = t => /net::ERR_|ERR_TUNNEL_CONNECTION_FAILED|Failed to load resource/i.test(t);
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    (isEnvNetwork(m.text()) ? networkNotes : errors).push('console: ' + m.text());
  });

  // Seed BEFORE the app loads, into the namespaced test key only.
  await page.addInitScript(seed => {
    localStorage.setItem('TEST__practicum_db_v5', JSON.stringify(seed));
    localStorage.setItem('TEST__practicum_user_identity', JSON.stringify({ name: 'בודק אוטומטי', email: 'test@example.com' }));
    // Production-looking keys, planted so we can prove they are never touched.
    localStorage.setItem('practicum_db_v5', JSON.stringify({ sentinel: 'PRODUCTION-DO-NOT-TOUCH' }));
    localStorage.setItem('supabase_enabled', '1');   // would auto-connect in prod
    window.__opened = [];
    const realOpen = window.open;
    window.open = function (u) { window.__opened.push(String(u || '')); return null; };
    window.confirm = () => true;
    window.alert = m => { (window.__alerts = window.__alerts || []).push(String(m)); };
    window.prompt = () => null;
  }, SEED);

  await page.goto(FILE_URL);
  await page.waitForTimeout(1200);   // let the 500ms cloud auto-connect window pass

  console.log('\n\x1b[1mIsolation\x1b[0m');
  check('page loads without script errors', errors.length === 0, errors.slice(0, 3).join('\n      '));
  check('test-mode banner is shown', await page.locator('#test-mode-banner').count() === 1);
  check('TEST_MODE is on', await page.evaluate(() => TEST_MODE) === true);

  const prodUntouched = await page.evaluate(() =>
    localStorage.getItem('practicum_db_v5') === JSON.stringify({ sentinel: 'PRODUCTION-DO-NOT-TOUCH' }));
  check('production storage key is untouched after load', prodUntouched);

  const cloudOff = await page.evaluate(() => ({ enabled: supabaseEnabled, client: !!supabaseClient }));
  check('cloud sync stayed off despite supabase_enabled=1', cloudOff.enabled === false && cloudOff.client === false,
    JSON.stringify(cloudOff));
  check('supabaseSaveData refuses to write', await page.evaluate(async () => await supabaseSaveData(true)) === false);

  console.log('\n\x1b[1mCandidates page\x1b[0m');
  await page.click('#btn-candidates');
  await page.waitForTimeout(200);
  check('the waiting-to-transfer banner appears', (await page.locator('#candidates-transfer-banner .alert').count()) === 1);
  check('three active candidates are listed', await page.evaluate(() => getActiveCandidates().length) === 3);
  check('interview summary is readable from the row', (await page.locator('#candidate-list details').count()) >= 1);
  check('the CV chip links to the file folder, not the course folder',
    await page.evaluate(() => {
      const a = document.querySelector('#candidate-list a.file-link');
      return !!a && decodeURIComponent(a.getAttribute('href')).includes('קורות_חיים');
    }));
  check('score chip is rendered', (await page.locator('#candidate-list').innerText()).includes('ציון 88'));

  console.log('\n\x1b[1mConversion keeps existing student intact\x1b[0m');
  const before = await page.evaluate(() => JSON.parse(JSON.stringify(DB.students.find(s => s.id === 10))));
  await page.evaluate(() => convertCandidateToStudent(1));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => JSON.parse(JSON.stringify(DB.students.find(s => s.id === 10))));

  const protectedFields = ['prepDone', 'prepDate', 'acceptedOrg', 'interviews', 'hired', 'preferences',
    'submitted', 'hoursReported', 'hoursApproved', 'hoursConfirmed', 'orgFeedback', 'file_cv', 'cvUrl', 'notes'];
  const moved = protectedFields.filter(f => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
  check('no protected field on the existing student changed', moved.length === 0, 'moved: ' + moved.join(', '));
  check('only candidacy + candidateId were added',
    JSON.stringify(Object.keys(after).filter(k => !(k in before)).sort()) === JSON.stringify(['candidacy', 'candidateId']),
    JSON.stringify(Object.keys(after).filter(k => !(k in before))));
  check('the interview summary landed on the student card',
    after.candidacy && after.candidacy.interviewSummary === 'מוטיבציה גבוהה, ניסיון קודם בגיוס.');
  check('the evaluation score came across', after.candidacy && after.candidacy.evalScore === 88);
  check('no duplicate student was created', await page.evaluate(() => DB.students.length) === 1);
  check('the candidate record was archived, not deleted', await page.evaluate(() => DB.candidates.length) === 3);
  check('the converted candidate left the active list', await page.evaluate(() => getActiveCandidates().length) === 2);
  check('the archive holds it', await page.evaluate(() => getArchivedCandidates().length) === 1);

  console.log('\n\x1b[1mRestore point\x1b[0m');
  const rp = await page.evaluate(() => listRestorePoints());
  check('a restore point was taken before the conversion', rp.length >= 1);
  await page.evaluate(id => restoreToPoint(id), rp[rp.length - 1].id);
  await page.waitForTimeout(300);
  const restored = await page.evaluate(() => JSON.parse(JSON.stringify(DB.students.find(s => s.id === 10))));
  check('restoring returns the student to the exact prior state',
    JSON.stringify(restored) === JSON.stringify(before));
  check('restoring puts the candidate back in the active list',
    await page.evaluate(() => getActiveCandidates().length) === 3);

  console.log('\n\x1b[1mNothing was sent\x1b[0m');
  const opened = await page.evaluate(() => window.__opened || []);
  const sends = opened.filter(u => /^mailto:/i.test(u) || /outlook\.office\.com/i.test(u));
  check('no mail or Outlook compose was opened', sends.length === 0, sends.join(', '));
  // and prove the block actually fires when something does try
  await page.evaluate(() => window.open('mailto:someone@example.com'));
  const blocked = await page.evaluate(() => BLOCKED_SENDS.length);
  check('an attempted send is intercepted and recorded', blocked === 1);

  const prodStillUntouched = await page.evaluate(() =>
    localStorage.getItem('practicum_db_v5') === JSON.stringify({ sentinel: 'PRODUCTION-DO-NOT-TOUCH' }));
  check('production storage key still untouched at the end', prodStillUntouched);
  check('test data went to the namespaced key', await page.evaluate(() => !!localStorage.getItem('TEST__practicum_db_v5')));

  check('still no script errors at the end', errors.length === 0, errors.slice(0, 3).join('\n      '));

  /* ---- production mode must be completely unaffected --------------------- */
  console.log('\n\x1b[1mProduction mode is unchanged\x1b[0m');
  const prodPage = await browser.newPage();
  const prodErrors = [];
  prodPage.on('pageerror', e => prodErrors.push(String(e)));
  prodPage.on('console', m => { if (m.type() === 'error' && !isEnvNetwork(m.text())) prodErrors.push(m.text()); });
  await prodPage.addInitScript(() => {
    // Data written by the OLD build, under the original key names.
    localStorage.setItem('practicum_db_v5', JSON.stringify({
      courses: [{ id: 'hr-practicum', name: 'פרקטיקום משאבי אנוש' }],
      academicYears: ['תשפ״ו'], currentCourse: 'hr-practicum', currentYear: 'תשפ״ו',
      candidates: [{ id: 1, name: 'רשומה ותיקה', courseId: 'hr-practicum', year: 'תשפ״ו', status: 'pending' }],
      students: [], employers: [], communications: [],
      settings: {}, currentUser: { name: 'a', email: 'b' }
    }));
    localStorage.setItem('practicum_pwd_skip', '1');
  });
  await prodPage.goto(FILE_URL.replace('?test=1', '?test=0'));
  await prodPage.waitForTimeout(900);
  const prod = await prodPage.evaluate(() => ({
    testMode: TEST_MODE,
    prefix: STORE_PREFIX,
    loaded: DB.candidates.length,
    name: DB.candidates[0] && DB.candidates[0].name,
    banner: document.querySelectorAll('#test-mode-banner').length,
    openPatched: /BLOCKED_SENDS/.test(String(window.open))
  }));
  check('test mode is off', prod.testMode === false);
  check('storage prefix is empty, so the original key names are used', prod.prefix === '');
  check('data written by the previous build still loads', prod.loaded === 1 && prod.name === 'רשומה ותיקה',
    JSON.stringify(prod));
  check('no test banner in production', prod.banner === 0);
  check('window.open is not intercepted in production', prod.openPatched === false);
  check('no script errors in production mode', prodErrors.length === 0, prodErrors.slice(0, 3).join('\n      '));
  await prodPage.close();

  await browser.close();
  if (networkNotes.length) {
    console.log('\n\x1b[33mnote:\x1b[0m ' + networkNotes.length + ' resource load failure(s) — this sandbox has no outbound network. ' +
      'The Supabase CDN tag cannot load here; test mode never uses it.');
  }
  console.log('\n' + '─'.repeat(60));
  console.log(fail === 0
    ? '\x1b[32m\x1b[1mSMOKE: ALL ' + pass + ' CHECKS PASSED\x1b[0m'
    : '\x1b[31m\x1b[1mSMOKE: ' + fail + ' FAILED\x1b[0m, ' + pass + ' passed');
  console.log('─'.repeat(60));
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
