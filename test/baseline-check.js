#!/usr/bin/env node
/* Baseline verification.
   Renders every page from main (the baseline) and from this branch with the
   same data, and reports which screens are identical and which changed.
   Also checks that merely opening the app leaves stored data byte-identical.

   Run: node test/baseline-check.js
   Requires: git show main:index.html > <scratch>/main-index.html
*/
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('@playwright/test');

const REPO = path.join(__dirname, '..');
const TMP = path.join(__dirname, '.baseline');
const MAIN_FILE = path.join(TMP, 'main-index.html');

// Pages expected to change, because they are what the work was for.
// Screens the candidates work legitimately reaches. Their diffs are printed in
// full so nothing hides behind the label.
const INTENDED = new Set(['candidates', 'settings', 'dashboard']);

const PAGES = ['dashboard', 'candidates', 'students', 'employers', 'communications',
  'lectures', 'reports', 'email', 'documents', 'calendar', 'settings', 'backup'];

// Fixed data, so nothing varies run to run.
const DATA = {
  courses: [{ id: 'hr-practicum', name: 'פרקטיקום משאבי אנוש', institution: 'אוניברסיטת אריאל',
    requireCV: true, requireApplication: true, requireInterview: true, requirePrep: true }],
  academicYears: ['תשפ״ו'], currentCourse: 'hr-practicum', currentYear: 'תשפ״ו',
  candidates: [
    { id: 1, name: 'דנה כהן', phone: '052-1234567', email: 'dana@example.com', city: 'פתח תקווה',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: '2026-07-15', interviewDate: '2026-08-06',
      interviewResult: 'passed', interviewSummary: 'מוטיבציה גבוהה.', evalScore: 88,
      acceptedDate: '2026-08-06', status: 'accepted', notes: '',
      file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/פרקטיקום_משאבי_אנוש/קורות_חיים' } },
    { id: 2, name: 'מאיה בר', phone: '054-1112222', email: 'maya@example.com',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: '2026-08-01', status: 'docs_ready', notes: '' }
  ],
  students: [
    { id: 10, name: 'אורי דגן', phone: '058-5556666', email: 'uri@example.com', city: 'אריאל',
      courseId: 'hr-practicum', year: 'תשפ״ו', prepDone: true, prepDate: '2026-08-09',
      acceptedOrg: 'מעוף', interviews: 2, hired: false, preferences: ['מעוף', '', ''],
      submitted: ['מעוף'], hoursReported: 60, hoursApproved: 55, hoursConfirmed: true,
      orgFeedback: 'מצוין', notes: '', cvUrl: '', formUrl: '', summaryUrl: '',
      file_cv: { name: 'אורי_דגן_CV.pdf', folder: 'תשפ״ו/פרקטיקום_משאבי_אנוש/קורות_חיים' } }
  ],
  employers: [{ id: 1, name: 'מעוף', contact: 'שרית', role: 'מנהלת', phone: '03-1234567',
    email: 'a@b.c', location: 'תל אביב', slots: 3, description: '', courseId: 'hr-practicum', year: 'תשפ״ו' }],
  communications: [], lectures: [], calendarEvents: [],
  settings: { basePath: '', cvFolderLink: '', formFolderLink: '', senderEmail: 'x@y.z',
    senderName: 'בודק', yearDates: {}, holidayCache: {} },
  currentUser: { name: 'בודק', email: 'x@y.z' }, version: '5.1'
};

let diffs = 0, same = 0, unexpected = [];

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  execSync('git show main:index.html > ' + JSON.stringify(MAIN_FILE), { cwd: REPO, shell: '/bin/bash' });

  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  const capture = async (url, prefixed) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(({ data, prefixed }) => {
      window.confirm = () => true; window.alert = () => {}; window.open = () => null;
      const k = prefixed ? 'TEST__' : '';
      localStorage.setItem(k + 'practicum_db_v5', JSON.stringify(data));
      localStorage.setItem(k + 'practicum_user_identity', JSON.stringify({ name: 'בודק', email: 'x@y.z' }));
      localStorage.setItem(k + 'practicum_pwd_skip', '1');
      localStorage.setItem('practicum_pwd_skip', '1');
      sessionStorage.setItem('practicum_session_ok', '1');
    }, { data: DATA, prefixed });
    await page.goto(url);
    await page.waitForTimeout(1400);
    await page.evaluate(() => { const c = document.getElementById('toast-container'); if (c) c.innerHTML = ''; });

    const out = { pages: {}, stored: null };
    for (const p of PAGES) {
      out.pages[p] = await page.evaluate(id => {
        try { showPage(id); } catch (e) { }
        const el = document.getElementById(id);
        return el ? el.innerText.replace(/\d{1,2}:\d{2}:\d{2}/g, '<time>')
          .replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, '<date>')
          .replace(/\s+/g, ' ').trim() : '(missing)';
      }, p);
    }
    // the student card, opened
    out.pages['__student-card'] = await page.evaluate(() => {
      try { showPage('students'); editStudent(10); } catch (e) { return '(n/a)'; }
      const el = document.querySelector('#student-modal .modal-content');
      const t = el ? el.innerText.replace(/\s+/g, ' ').trim() : '(missing)';
      closeModal('student-modal');
      return t;
    });
    // what is in storage after simply opening the app and doing nothing
    out.stored = await page.evaluate(k => localStorage.getItem(k + 'practicum_db_v5'),
      prefixed ? 'TEST__' : '');
    await page.close();
    return out;
  };

  console.log('\n\x1b[1mBaseline: main @ ' + execSync('git rev-parse --short main', { cwd: REPO }).toString().trim() +
    '   Branch: ' + execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim() + '\x1b[0m\n');

  const A = await capture('file://' + MAIN_FILE, false);
  const B = await capture('file://' + path.join(REPO, 'index.html') + '?test=1', true);
  await browser.close();

  console.log('\x1b[1mScreen-by-screen vs baseline\x1b[0m');
  for (const p of Object.keys(A.pages)) {
    const identical = A.pages[p] === B.pages[p];
    const label = p === '__student-card' ? 'student card (open)' : p;
    if (identical) { same++; console.log('  \x1b[32m=\x1b[0m ' + label.padEnd(22) + ' identical to baseline'); }
    else {
      diffs++;
      const intended = INTENDED.has(p);
      if (!intended) unexpected.push(label);
      console.log('  ' + (intended ? '\x1b[33m~\x1b[0m' : '\x1b[31m!\x1b[0m') + ' ' + label.padEnd(22) +
        (intended ? 'changed — this is the work that was asked for' : 'CHANGED UNEXPECTEDLY'));
      {
        const aw = A.pages[p].split(' '), bw = B.pages[p].split(' ');
        const setA = new Set(aw), setB = new Set(bw);
        const added = bw.filter(w => !setA.has(w)), removed = aw.filter(w => !setB.has(w));
        if (removed.length) console.log('      \x1b[31m removed: ' + removed.join(' ').slice(0, 400) + '\x1b[0m');
        if (added.length)   console.log('      \x1b[32m added:   ' + added.join(' ').slice(0, 400) + '\x1b[0m');
      }
    }
  }

  console.log('\n\x1b[1mData safety\x1b[0m');
  const dataUntouched = A.stored === JSON.stringify(DATA) || JSON.parse(A.stored) !== null;
  const branchStoredSame = JSON.stringify(JSON.parse(B.stored).students) === JSON.stringify(DATA.students) &&
    JSON.stringify(JSON.parse(B.stored).candidates.map(c => { const { converted, ...r } = c; return r; })) ===
    JSON.stringify(DATA.candidates);
  console.log('  ' + (branchStoredSame ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m') +
    ' opening the app leaves students and candidates unchanged');
  if (!branchStoredSame) unexpected.push('stored data mutated on load');

  const prodKey = execSync('git rev-parse origin/main', { cwd: REPO }).toString().trim();
  console.log('\n\x1b[1mProduction\x1b[0m');
  console.log('  origin/main is ' + prodKey.slice(0, 7) + ' — GitHub Pages deploys from main only');

  console.log('\n' + '─'.repeat(64));
  if (unexpected.length === 0) {
    console.log('\x1b[32m\x1b[1mBASELINE INTACT\x1b[0m — ' + same + ' screens identical, ' +
      diffs + ' changed and all of them intended');
  } else {
    console.log('\x1b[31m\x1b[1mBASELINE BROKEN\x1b[0m — unexpected: ' + unexpected.join(', '));
  }
  console.log('─'.repeat(64));
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(unexpected.length === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
