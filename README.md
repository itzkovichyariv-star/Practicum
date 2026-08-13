# Practicum (v1) — archived

**This repository is archived. It is superseded by
[itzkovichyariv-star/Practicum-v2](https://github.com/itzkovichyariv-star/Practicum-v2),
which runs the live system at <https://practicum.yarivitzkovich.org>.**

Do not develop here. Do not deploy from here.

## Why it was taken down rather than left running

v1 and v2 point at the **same Supabase project and the same row** —
`practicum_data`, `org_id = 'default'`:

| | v1 (this repo) | v2 (live) |
|---|---|---|
| Project | `vpqgmcmavnszcnakhiat` | `vpqgmcmavnszcnakhiat` |
| Table | `practicum_data` | `practicum_data` |
| Row | `org_id='default'`, newest | `org_id='default'` |

v1's `supabaseSaveData()` replaces the whole `data` blob with a snapshot of
exactly fourteen keys, on a blind `.update()` with no version guard, fired by an
800 ms debounce after any change. The live blob carries keys v1 has never heard
of — among them `dispatches`, `trainers`, `employerApprovalRequests`,
`placementSettings`, `interviewZoomLinks`, `coordinatorEmail`, `supervisorEmail`
and `notifyEmails`.

So a signed-in session in v1 could overwrite the live row and drop every one of
those fields. That is why the deployed page is now a static notice instead of the
application.

## What is still here

- `index.html` — a static notice pointing at the live system. No scripts, no
  network calls, no storage.
- `archive/practicum-v1.html.txt` — the complete v1 application, byte-identical
  to `index.html` at commit `7b42232`. The `.txt` extension is deliberate: GitHub
  Pages serves it as plain text, so the archived copy can be read but cannot be
  launched from the live URL and cannot reach the database. To run it locally,
  copy it to a `.html` file.

Full history remains in git. Nothing was deleted.
