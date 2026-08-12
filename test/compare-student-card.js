#!/usr/bin/env node
/* Renders the student card from main and from this branch, both in their real
   default state, so the change to that screen can be judged side by side.
   Run: node test/compare-student-card.js
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, 'shots');
const SCRATCH = process.env.SCRATCH || '/tmp';
const MAIN_FILE = path.join(SCRATCH, 'main-index.html');

const DATA = {
  courses: [{ id: 'hr-practicum', name: 'פרקטיקום משאבי אנוש', requireCV: true, requireApplication: true, requireInterview: true, requirePrep: true }],
  academicYears: ['תשפ״ו'], currentCourse: 'hr-practicum', currentYear: 'תשפ״ו',
  candidates: [], employers: [], communications: [], lectures: [], calendarEvents: [],
  settings: { basePath: '', senderEmail: 'x@y.z', senderName: 'בודק', yearDates: {}, holidayCache: {} },
  currentUser: { name: 'ד"ר יריב איצקוביץ', email: 'yarivi@ariel.ac.il' },
  students: [{
    id: 10, name: 'דנה כהן', phone: '0521234567', email: 'dana@example.com', city: 'פתח תקווה',
    courseId: 'hr-practicum', year: 'תשפ״ו', prepDone: true, prepDate: '2026-08-09',
    acceptedOrg: '', interviews: 2, hired: false, preferences: ['', '', ''], submitted: [],
    hoursReported: 0, hoursApproved: 0, hoursConfirmed: false, orgFeedback: '',
    notes: '', cvUrl: '', formUrl: '', summaryUrl: '',
    file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/פרקטיקום_משאבי_אנוש/קורות_חיים' },
    candidateId: 1,
    candidacy: {
      candidateId: 1, applicationDate: '2026-07-15', interviewDate: '2026-08-06',
      interviewResult: 'passed', interviewSummary: 'מוטיבציה גבוהה, ניסיון קודם בגיוס במסגרת התנדבותית. תקשורת בינונית. ממליץ לקבל.',
      preferredArea: 'גיוס ומיון', acceptedDate: '2026-08-06', evalScore: 88,
      evals: { commitment: 'גבוה', motivation: 'גבוה', communication: 'בינוני', english: 'גבוה', acquaintance: 'נמוך' },
      convertedDate: '2026-08-12', convertedBy: 'ד"ר יריב איצקוביץ'
    }
  }],
  version: '5.1'
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  const render = async (file, url, out, prefixed) => {
    const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
    await page.addInitScript(({ data, prefixed }) => {
      window.confirm = () => true; window.alert = () => {};
      const k = prefixed ? 'TEST__' : '';
      localStorage.setItem(k + 'practicum_db_v5', JSON.stringify(data));
      localStorage.setItem(k + 'practicum_user_identity', JSON.stringify({ name: 'ד"ר יריב איצקוביץ', email: 'yarivi@ariel.ac.il' }));
      localStorage.setItem(k + 'practicum_pwd_skip', '1');
      localStorage.setItem('practicum_pwd_skip', '1');
      sessionStorage.setItem('practicum_session_ok', '1');
    }, { data: DATA, prefixed });
    await page.goto(url);
    await page.waitForTimeout(1200);
    await page.evaluate(() => { const c = document.getElementById('toast-container'); if (c) c.innerHTML = ''; });
    await page.evaluate(() => { showPage('students'); editStudent(10); });
    await page.waitForTimeout(500);
    await page.locator('#student-modal .modal-content').screenshot({ path: path.join(OUT, out + '.png') });
    console.log('  ' + out + '.png');
    await page.close();
  };

  console.log('rendering student card, default state:');
  await render(MAIN_FILE, 'file://' + MAIN_FILE, 'A-student-card-BEFORE', false);
  await render('index.html', 'file://' + path.join(__dirname, '..', 'index.html') + '?test=1', 'B-student-card-AFTER', true);

  await browser.close();
  console.log('\nwritten to ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
