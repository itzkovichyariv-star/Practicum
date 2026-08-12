#!/usr/bin/env node
/* Renders the screens to PNGs for review.
   Run: node test/shots.js   ->  test/shots/*.png
*/
const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const OUT = path.join(__dirname, 'shots');
const FILE_URL = 'file://' + path.join(__dirname, '..', 'index.html') + '?test=1&seed=1';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']
    .find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
  const browser = await chromium.launch(exe ? { executablePath: exe } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 });
  await page.addInitScript(() => {
    window.confirm = () => true; window.alert = () => {};
    // Pre-set identity so the first-run modal does not cover the screens.
    localStorage.setItem('TEST__practicum_user_identity',
      JSON.stringify({ name: 'ד"ר יריב איצקוביץ', email: 'yarivi@ariel.ac.il' }));
  });

  await page.goto(FILE_URL);
  await page.waitForTimeout(1500);
  // clear the seed toast so it does not sit over the header
  await page.evaluate(() => { const c = document.getElementById('toast-container'); if (c) c.innerHTML = ''; });

  const shot = async (name, sel) => {
    const target = sel ? page.locator(sel) : page;
    await target.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  ' + name + '.png');
  };

  console.log('rendering:');

  await page.evaluate(() => showPage('candidates'));
  await page.waitForTimeout(400);
  await shot('1-candidates', '#candidates');

  // open every interview summary so the expanded state is visible
  await page.evaluate(() => document.querySelectorAll('#candidate-list details').forEach(d => d.open = true));
  await page.waitForTimeout(250);
  await shot('2-candidates-expanded', '#candidates');

  // archive view
  await page.evaluate(() => { convertCandidateToStudent(1); });
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.getElementById('candidate-show-archive').checked = true; renderCandidates(); });
  await page.waitForTimeout(300);
  await shot('3-candidates-archive', '#candidates');
  await page.evaluate(() => { document.getElementById('candidate-show-archive').checked = false; renderCandidates(); });

  await page.evaluate(() => showPage('students'));
  await page.waitForTimeout(400);
  await shot('4-students', '#students');

  // student card with the candidacy panel open
  await page.evaluate(() => { editStudent(10); const d = document.querySelector('#student-candidacy-section details'); if (d) d.open = true; });
  await page.waitForTimeout(400);
  await shot('5-student-card-candidacy', '#student-modal .modal-content');
  await page.evaluate(() => closeModal('student-modal'));

  await page.evaluate(() => { showPage('settings'); renderSettingsPage(); });
  await page.waitForTimeout(500);
  await shot('6-settings-links', '#link-audit-section');
  await shot('7-settings-safety', '#data-safety-section');

  await page.evaluate(() => showPage('dashboard'));
  await page.waitForTimeout(500);
  await shot('8-dashboard', '#dashboard');

  await browser.close();
  console.log('\nwritten to ' + OUT);
})().catch(e => { console.error(e); process.exit(1); });
