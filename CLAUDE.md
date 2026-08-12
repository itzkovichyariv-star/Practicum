# Practicum — project notes

Single-file app: everything lives in `index.html`. No build step. `main` deploys
to GitHub Pages; feature branches do not deploy.

## Standing preferences

**Write in English.** All replies, commit messages, PR text and code comments are
in English, regardless of the language the request was written in. This applies
to how I communicate, not to the product: the app's UI, its copy and any
user-facing document remain Hebrew and right-to-left.

**Always give a link that lands on the exact spot.** Never write navigation
directions ("open Settings, scroll down to…") when a link can do it. Every
reference to a place gets a URL that arrives there directly:

- app screens — deep links, see below
- code — `file:line` (clickable in the terminal)
- GitHub — link the PR, the file at that ref, or the specific line range
- documents — link the anchor, not the document

If arriving directly is not yet possible, add the deep link rather than falling
back to directions.

## Deep links into the app

`applyDeepLink()` reads the hash on load and on `hashchange`:

| Form | Lands on |
|---|---|
| `#candidates` | a page, by nav id |
| `#settings/links` | a page, scrolled to a section, briefly highlighted |
| `?seed=1` | test mode only — loads sample data first |

Section targets are the container element ids (`link-audit-section`,
`data-safety-section`, …). Add a new one by giving the container an id; no
registration needed.

## Test environment

`?test=1`, or any host that is not the production Pages host, turns on
`TEST_MODE`. It namespaces every storage key with `TEST__`, hard-disables cloud
sync, blocks every outbound message, and skips the password gate. Production
behaviour is unchanged and is covered by tests. See `test/README.md`.

## The invariant this codebase enforces

On a student record that already exists, the candidate→student feature writes
**only** `candidacy` and `candidateId`. Never a status, never a file, never a
link. `runGuarded()` verifies after every mutation and rolls back automatically
on violation. The protected list is `PROTECTED_STUDENT_FIELDS`.

## Frozen — do not implement without an explicit instruction

Renaming CV files (`CV_מועמדות` / `CV_מעודכן`). Share links already sent to
organisations point at current filenames; renaming breaks them. Requires mapping
the links already in the wild first. Building file-level *links* is separate and
already shipped behind `DB.settings.fileLevelLinks`.

## Tests

```
npm test          # logic, extracted from index.html itself
npm run test:e2e  # real browser, includes a production-mode regression check
```

Run both before pushing. The browser tests need
`executablePath` pointing at the sandbox Chromium; `test/smoke.js` handles that.
