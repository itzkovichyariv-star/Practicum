#!/usr/bin/env node
/* Renders the same screens from main and from this branch, same data, for
   side-by-side approval. Output: test/shots/approval/<page>-BEFORE|AFTER.png
   Run: node test/approval-shots.js
*/
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { chromium } = require('@playwright/test');

const REPO = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots', 'approval');
const TMP = path.join(__dirname, '.baseline');
const MAIN_FILE = path.join(TMP, 'main-index.html');

const ago = n => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];
const F = (folder, name) => ({ name, folder: 'תשפ״ו/פרקטיקום_משאבי_אנוש/' + folder });

const DATA = {
  courses: [{ id: 'hr-practicum', name: 'פרקטיקום משאבי אנוש', institution: 'אוניברסיטת אריאל',
    requireCV: true, requireApplication: true, requireInterview: true, requirePrep: true }],
  academicYears: ['תשפ״ו'], currentCourse: 'hr-practicum', currentYear: 'תשפ״ו',
  candidates: [
    { id: 1, name: 'דנה כהן', phone: '052-1234567', email: 'dana@example.com', city: 'פתח תקווה',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: ago(28), interviewDate: ago(6),
      interviewResult: 'passed', interviewSummary: 'מוטיבציה גבוהה, ניסיון קודם בגיוס במסגרת התנדבותית. ממליץ לקבל.',
      evalCommitment: 'גבוה', evalMotivation: 'גבוה', evalCommunication: 'בינוני', evalEnglish: 'גבוה',
      evalAcquaintance: 'נמוך', evalScore: 88, preferredArea: 'גיוס ומיון', acceptedDate: ago(6),
      status: 'accepted', notes: 'מעדיפה ימי שני ורביעי',
      file_cv: F('קורות_חיים', 'דנה_כהן_CV.pdf'), file_application: F('טפסי_מועמדות', 'דנה_כהן_טופס_הגשה.pdf') },
    { id: 2, name: 'מאיה בר', phone: '054-1112222', email: 'maya@example.com', city: 'כפר סבא',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: ago(9), status: 'docs_ready', notes: '',
      file_cv: F('קורות_חיים', 'מאיה_בר_CV.pdf'), file_application: F('טפסי_מועמדות', 'מאיה_בר_טופס_הגשה.pdf') },
    { id: 3, name: 'רון שגב', phone: '050-3334444', email: 'ron@example.com',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: ago(40), interviewDate: ago(17),
      interviewResult: 'failed', rejectionReason: 'לא הציג התאמה לתחום', status: 'rejected', notes: '',
      file_cv: F('קורות_חיים', 'רון_שגב_CV.pdf') },
    { id: 4, name: 'טל אבני', phone: '058-7778888', email: 'tal@example.com',
      courseId: 'hr-practicum', year: 'תשפ״ו', applicationDate: ago(16), status: 'pending',
      notes: 'טרם הועלו מסמכים' }
  ],
  students: [
    { id: 10, name: 'אורי דגן', phone: '058-5556666', email: 'uri@example.com', city: 'אריאל',
      courseId: 'hr-practicum', year: 'תשפ״ו', prepDone: true, prepDate: ago(3),
      acceptedOrg: 'מעוף', interviews: 2, hired: false, preferences: ['מעוף', 'נישה פרו', ''],
      submitted: ['מעוף', 'נישה פרו'], hoursReported: 60, hoursApproved: 55, hoursConfirmed: true,
      orgFeedback: 'מצוין', notes: '', cvUrl: '', formUrl: '', summaryUrl: '',
      file_cv: F('קורות_חיים', 'אורי_דגן_CV.pdf'), file_form: F('טפסי_הגשה', 'אורי_דגן_טופס.pdf') },
    { id: 11, name: 'נועה שקד', phone: '052-2223333', email: 'noa@example.com', city: 'רעננה',
      courseId: 'hr-practicum', year: 'תשפ״ו', prepDone: false, acceptedOrg: '', interviews: 0,
      hired: false, preferences: ['', '', ''], submitted: [], notes: '', cvUrl: '', formUrl: '', summaryUrl: '' }
  ],
  employers: [{ id: 1, name: 'מעוף', contact: 'שרית', role: 'מנהלת מש״א', phone: '03-1234567',
    email: 'a@b.c', location: 'תל אביב', slots: 3, description: '', courseId: 'hr-practicum', year: 'תשפ״ו' }],
  communications: [], lectures: [], calendarEvents: [],
  settings: { basePath: '', cvFolderLink: '', formFolderLink: '', senderEmail: 'x@y.z',
    senderName: 'ד"ר יריב איצקוביץ', yearDates: {}, holidayCache: {} },
  currentUser: { name: 'ד"ר יריב איצקוביץ', email: 'yarivi@ariel.ac.il' }, version: '5.1'
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });
  execSync('git show main:index.html > ' + JSON.stringify(MAIN_FILE), { cwd: REPO, shell: '/bin/bash' });

  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});

  const run = async (url, prefixed, tag) => {
    const page = await browser.newPage({ viewport: { width: 1180, height: 900 } });
    await page.addInitScript(({ data, prefixed }) => {
      window.confirm = () => true; window.alert = () => {}; window.open = () => null;
      const k = prefixed ? 'TEST__' : '';
      localStorage.setItem(k + 'practicum_db_v5', JSON.stringify(data));
      localStorage.setItem(k + 'practicum_user_identity', JSON.stringify({ name: 'ד"ר יריב איצקוביץ', email: 'yarivi@ariel.ac.il' }));
      localStorage.setItem(k + 'practicum_pwd_skip', '1');
      localStorage.setItem('practicum_pwd_skip', '1');
      sessionStorage.setItem('practicum_session_ok', '1');
    }, { data: DATA, prefixed });
    await page.goto(url);
    await page.waitForTimeout(1400);
    await page.evaluate(() => {
      const c = document.getElementById('toast-container'); if (c) c.innerHTML = '';
      const b = document.getElementById('test-mode-banner'); if (b) b.remove();
    });

    const shot = async (name, sel) => {
      const t = sel ? page.locator(sel) : page;
      await t.screenshot({ path: path.join(OUT, name + '-' + tag + '.png') });
      console.log('  ' + name + '-' + tag + '.png');
    };

    await page.evaluate(() => showPage('candidates'));
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll('#candidate-list details').forEach(d => d.open = true));
    await page.waitForTimeout(200);
    await shot('candidates', '#candidates');

    await page.evaluate(() => showPage('students'));
    await page.waitForTimeout(400);
    await shot('students', '#students');

    await page.evaluate(() => { showPage('students'); editStudent(10); });
    await page.waitForTimeout(400);
    await shot('student-card', '#student-modal .modal-content');
    await page.evaluate(() => closeModal('student-modal'));

    await page.evaluate(() => showPage('dashboard'));
    await page.waitForTimeout(500);
    await shot('dashboard', '#dashboard');

    await page.close();
  };

  console.log('BEFORE (main):');
  await run('file://' + MAIN_FILE, false, 'BEFORE');
  console.log('AFTER (branch):');
  await run('file://' + path.join(REPO, 'index.html') + '?test=1', true, 'AFTER');

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log('\nwritten to ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
