#!/usr/bin/env node
/* Extracts the CANDIDACY-CORE block straight out of index.html and exercises it.
   Single source of truth: if the shipped code changes, these tests see it.

   Run: node test/run-tests.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const BEGIN = '/* ===== BEGIN CANDIDACY-CORE';
const END = '/* ===== END CANDIDACY-CORE';
const b = SRC.indexOf(BEGIN), e = SRC.indexOf(END);
if (b === -1 || e === -1) { console.error('FATAL: CANDIDACY-CORE markers not found in index.html'); process.exit(1); }
const core = SRC.slice(b, e);

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(core + '\nthis.__api = {' + [
  'PROTECTED_STUDENT_FIELDS','WRITABLE_ON_EXISTING_STUDENT','candNormName','candPhoneKey','candEmailKey',
  'matchStudentForCandidate','buildStudentFromCandidate','attachCandidacyToStudent',
  'convertCandidateInPlace','migrateCandidateStudentLinks','getActiveCandidatesFrom','getArchivedCandidatesFrom',
  'verifyNoStudentStatusChange','stableStringify'
].join(',') + '};', sandbox);
const A = sandbox.__api;

/* ---- tiny harness -------------------------------------------------------- */
let pass = 0, fail = 0;
const failures = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  \x1b[32m✓\x1b[0m ' + name); }
  catch (err) { fail++; failures.push({ name, err }); console.log('  \x1b[31m✗\x1b[0m ' + name + '\n      ' + err.message); }
}
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), x = JSON.stringify(expected);
  if (a !== x) throw new Error((msg || 'mismatch') + '\n      expected: ' + x + '\n      actual:   ' + a);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }
function section(s) { console.log('\n\x1b[1m' + s + '\x1b[0m'); }

const META = { date: '2026-08-12', by: 'test-runner' };
const clone = o => JSON.parse(JSON.stringify(o));

/* ---- fixtures ------------------------------------------------------------ */
function fixture() {
  return {
    candidates: [
      // passed interview, has a matching student already (the real-world backlog case)
      { id: 1, name: 'דנה כהן', phone: '052-1234567', email: 'dana@example.com', city: 'פתח תקווה',
        courseId: 'hr', year: 'תשפ״ו', applicationDate: '2026-01-14', interviewDate: '2026-02-03',
        interviewResult: 'passed', interviewSummary: 'מוטיבציה גבוהה, ניסיון קודם בגיוס.',
        evalCommitment: 'גבוה', evalMotivation: 'גבוה', evalCommunication: 'בינוני',
        evalEnglish: 'גבוה', evalAcquaintance: 'נמוך', evalScore: 88,
        preferredArea: 'גיוס ומיון', acceptedDate: '2026-02-03', status: 'accepted',
        notes: 'מעדיפה שני ורביעי', file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/hr/קורות_חיים' },
        file_application: { name: 'דנה_כהן_טופס.pdf', folder: 'תשפ״ו/hr/טפסי_מועמדות' } },
      // passed interview, NO student record yet
      { id: 2, name: 'יוסי לוי', phone: '053-7654321', email: 'yossi@example.com', city: 'אריאל',
        courseId: 'hr', year: 'תשפ״ו', applicationDate: '2026-01-20', interviewDate: '2026-02-10',
        interviewResult: 'passed', interviewSummary: 'מתאים.', evalScore: 79, status: 'accepted',
        notes: '', file_cv: { name: 'יוסי_לוי_CV.pdf', folder: 'תשפ״ו/hr/קורות_חיים' } },
      // still a candidate
      { id: 3, name: 'מאיה בר', phone: '054-1112222', email: 'maya@example.com',
        courseId: 'hr', year: 'תשפ״ו', applicationDate: '2026-02-01', status: 'docs_ready', notes: '' },
      // rejected — must stay a candidate
      { id: 4, name: 'רון שגב', phone: '050-3334444', email: 'ron@example.com',
        courseId: 'hr', year: 'תשפ״ו', interviewResult: 'failed', rejectionReason: 'לא מתאים',
        status: 'rejected', notes: '' },
      // same name as a student but a DIFFERENT year — must not match
      { id: 5, name: 'דנה כהן', phone: '052-9999999', email: 'dana2@example.com',
        courseId: 'hr', year: 'תשפ״ה', status: 'pending', notes: '' }
    ],
    students: [
      // mid-flight student with real placement state that must not be touched
      { id: 10, name: 'דנה כהן', phone: '0521234567', email: 'DANA@example.com', city: 'פתח תקווה',
        courseId: 'hr', year: 'תשפ״ו', prepDone: true, prepDate: '2026-03-01',
        acceptedOrg: 'מעוף', interviews: 2, hired: false,
        preferences: ['מעוף', 'נישה פרו', ''], submitted: ['מעוף', 'נישה פרו'],
        hoursReported: 60, hoursApproved: 55, hoursConfirmed: true, orgFeedback: 'מצוינת',
        file_cv: { name: 'דנה_כהן_CV.pdf', folder: 'תשפ״ו/hr/קורות_חיים' },
        file_form: { name: 'דנה_כהן_טופס.pdf', folder: 'תשפ״ו/hr/טפסי_מועמדות' },
        cvUrl: 'https://sharepoint.example/share/abc123', formUrl: '', summaryUrl: '',
        notes: 'ותיקה', fromCandidate: false },
      // unrelated student
      { id: 11, name: 'אורי דגן', phone: '058-5556666', email: 'uri@example.com',
        courseId: 'hr', year: 'תשפ״ו', prepDone: false, acceptedOrg: '', interviews: 0, hired: false,
        preferences: ['', '', ''], submitted: [], notes: '' }
    ]
  };
}

/* ---- matching ------------------------------------------------------------ */
section('Identity matching');

test('matches on email regardless of case and phone formatting', () => {
  const f = fixture();
  const m = A.matchStudentForCandidate(f.candidates[0], f.students);
  ok(m, 'expected a match');
  eq(m.by, 'email');
  eq(m.student.id, 10);
});

test('matches on last 9 phone digits when email differs', () => {
  const f = fixture();
  f.candidates[0].email = 'different@example.com';
  const m = A.matchStudentForCandidate(f.candidates[0], f.students);
  ok(m); eq(m.by, 'phone'); eq(m.student.id, 10);
});

test('matches on normalised name when email and phone are absent', () => {
  const f = fixture();
  f.candidates[0].email = ''; f.candidates[0].phone = '';
  f.candidates[0].name = '  דנה   כהן ';
  const m = A.matchStudentForCandidate(f.candidates[0], f.students);
  ok(m); eq(m.by, 'name');
});

test('does NOT match the same name in a different academic year', () => {
  const f = fixture();
  eq(A.matchStudentForCandidate(f.candidates[4], f.students), null);
});

test('does not match a candidate with no counterpart', () => {
  const f = fixture();
  eq(A.matchStudentForCandidate(f.candidates[1], f.students), null);
});

/* ---- the invariant ------------------------------------------------------- */
section('The invariant: existing students are never restatused');

test('merging into an existing student changes only candidateId', () => {
  const f = fixture();
  const before = clone(f);
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  const v = A.verifyNoStudentStatusChange(before, f);
  eq(v.violations, []);
  ok(v.ok, 'verification must pass');
});

test('placement state on the merged student is byte-identical afterwards', () => {
  const f = fixture();
  const before = clone(f.students[0]);
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  const after = f.students[0];
  ['prepDone','prepDate','acceptedOrg','interviews','hired','preferences','submitted',
   'hoursReported','hoursApproved','hoursConfirmed','orgFeedback'].forEach(k => {
    eq(after[k], before[k], 'field ' + k + ' must not change');
  });
});

test('files and share links on the merged student are untouched', () => {
  const f = fixture();
  const before = clone(f.students[0]);
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  eq(f.students[0].file_cv, before.file_cv, 'file_cv must not change');
  eq(f.students[0].file_form, before.file_form, 'file_form must not change');
  eq(f.students[0].cvUrl, before.cvUrl, 'cvUrl (share link) must not change');
});

test('migration over the whole DB leaves every protected field alone', () => {
  const f = fixture();
  const before = clone(f);
  A.migrateCandidateStudentLinks(f, META);
  const v = A.verifyNoStudentStatusChange(before, f);
  eq(v.violations, []);
});

test('migration never creates a student record', () => {
  const f = fixture();
  const n = f.students.length;
  A.migrateCandidateStudentLinks(f, META);
  eq(f.students.length, n, 'student count must be unchanged by migration');
});

/* ---- conversion behaviour ------------------------------------------------ */
section('Conversion behaviour');

test('a candidate with no student record creates one, carrying their CV', () => {
  const f = fixture();
  const r = A.convertCandidateInPlace(f.candidates[1], f.candidates, f.students, META);
  eq(r.mode, 'new');
  const s = f.students.find(x => x.id === r.studentId);
  ok(s, 'new student exists');
  eq(s.candidateId, 2, 'linked back to the candidacy record');
  eq(s.file_cv, f.candidates[1].file_cv, 'CV object carried across unchanged');
  eq(s.prepDone, false, 'new student starts before preparation');
  eq(s.acceptedOrg, '', 'new student has no placement');
});

test('the student record carries no copy of the candidacy file', () => {
  const f = fixture();
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  A.convertCandidateInPlace(f.candidates[1], f.candidates, f.students, META);
  f.students.forEach(s => ok(!('candidacy' in s), 'student ' + s.id + ' must not carry a candidacy copy'));
});

test('the interview record survives, on the archived candidate', () => {
  const f = fixture();
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  const c = f.candidates[0];
  eq(c.interviewSummary, 'מוטיבציה גבוהה, ניסיון קודם בגיוס.');
  eq(c.evalScore, 88);
  eq(c.evalCommitment, 'גבוה');
  eq(c.converted, true, 'archived rather than deleted');
  eq(f.students[0].candidateId, 1, 'and reachable from the student by id');
});

test('the candidate record is archived, never deleted', () => {
  const f = fixture();
  const n = f.candidates.length;
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  eq(f.candidates.length, n, 'no candidate record may be removed');
  eq(f.candidates[0].converted, true);
  eq(f.candidates[0].studentId, 10);
});

test('converting twice does not double-write the link', () => {
  const f = fixture();
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  const snap = clone(f.students[0]);
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  eq(f.students[0], snap, 'second conversion must be a no-op on the student');
  eq(f.students.length, 2, 'no duplicate student created');
});

test('converted candidates leave the active list but stay in the archive', () => {
  const f = fixture();
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  const active = A.getActiveCandidatesFrom(f.candidates);
  const archived = A.getArchivedCandidatesFrom(f.candidates);
  eq(active.map(c => c.id), [2, 3, 4, 5]);
  eq(archived.map(c => c.id), [1]);
  eq(active.length + archived.length, f.candidates.length, 'no record falls between the two lists');
});

test('a rejected candidate stays on the candidates page', () => {
  const f = fixture();
  A.migrateCandidateStudentLinks(f, META);
  const active = A.getActiveCandidatesFrom(f.candidates);
  ok(active.some(c => c.id === 4), 'rejected candidate must remain active');
});

/* ---- migration report ---------------------------------------------------- */
section('Migration report');

test('reports linked, pending-transfer and active counts correctly', () => {
  const f = fixture();
  const r = A.migrateCandidateStudentLinks(f, META);
  eq(r.linked, 1, 'דנה links to the existing student');
  eq(r.pendingTransfer, 1, 'יוסי passed but has no student -> awaits a human');
  eq(r.active, 3, 'maya + ron + the other-year דנה stay active');
});

test('migration is idempotent', () => {
  const f = fixture();
  A.migrateCandidateStudentLinks(f, META);
  const afterFirst = clone(f);
  const r2 = A.migrateCandidateStudentLinks(f, META);
  eq(r2.linked, 0);
  eq(r2.alreadyDone, 5);
  eq(f, afterFirst, 'a second run must change nothing');
});

/* ---- the verifier itself ------------------------------------------------- */
section('The verifier catches real violations');

test('catches a changed placement status', () => {
  const f = fixture(); const before = clone(f);
  f.students[0].acceptedOrg = 'ארגון אחר';
  const v = A.verifyNoStudentStatusChange(before, f);
  ok(!v.ok, 'must fail');
  ok(v.violations.some(x => x.field === 'acceptedOrg'), 'must name the field');
});

test('catches a rewritten CV file', () => {
  const f = fixture(); const before = clone(f);
  f.students[0].file_cv = { name: 'דנה_כהן_CV_מעודכן.pdf', folder: 'תשפ״ו/hr/קורות_חיים' };
  const v = A.verifyNoStudentStatusChange(before, f);
  ok(!v.ok);
  ok(v.violations.some(x => x.field === 'file_cv'));
});

test('catches a lost candidate record', () => {
  const f = fixture(); const before = clone(f);
  f.candidates.splice(0, 1);
  const v = A.verifyNoStudentStatusChange(before, f);
  ok(!v.ok);
  ok(v.violations.some(x => x.issue === 'candidate records lost'));
});

test('catches an unexpected new field on an existing student', () => {
  const f = fixture(); const before = clone(f);
  f.students[0].someNewFlag = true;
  const v = A.verifyNoStudentStatusChange(before, f);
  ok(!v.ok);
  ok(v.violations.some(x => x.field === 'someNewFlag'));
});

/* ---- restore-point round trip -------------------------------------------- */
section('Restore point round trip');

test('a snapshot restores the exact prior state after a conversion', () => {
  const f = fixture();
  const restorePoint = clone(f);
  A.convertCandidateInPlace(f.candidates[0], f.candidates, f.students, META);
  A.convertCandidateInPlace(f.candidates[1], f.candidates, f.students, META);
  ok(JSON.stringify(f) !== JSON.stringify(restorePoint), 'data did change');
  const restored = clone(restorePoint);
  eq(restored, restorePoint, 'restoring returns to exactly the snapshot');
});

/* ---- summary ------------------------------------------------------------- */
console.log('\n' + '─'.repeat(60));
console.log(fail === 0
  ? '\x1b[32m\x1b[1mALL ' + pass + ' TESTS PASSED\x1b[0m'
  : '\x1b[31m\x1b[1m' + fail + ' FAILED\x1b[0m, ' + pass + ' passed');
console.log('─'.repeat(60));
process.exit(fail === 0 ? 0 : 1);
