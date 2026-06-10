---
phase: 4
slug: admin-panel-question-management
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-11
---

# Phase 4 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Admin browser → Backend API | REST calls for questions CRUD, stats, CSV upload | Admin commands, question data, game count |
| Admin browser → WebSocket | WebSocket connection for game control (start/restart) | Admin control commands, player join events |
| CSV file → Backend parser | Untrusted file content enters Python `csv` module | Question text, answer values, categories |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-04-01 | Spoofing | GET /api/stats | accept | No auth on stats endpoint — game count is public data, local-only WiFi deployment. ASVS V2 not applicable. | closed |
| T-04-02 | Tampering | WebSocket start_game/restart | accept | Any WebSocket client could send start_game. Acceptable for local WiFi booth: first-connect-wins admin slot. ASVS V2 not applicable. | closed |
| T-04-03 | Tampering | DELETE /api/questions/{id} | accept | Any client can delete questions. Acceptable for local WiFi booth with no auth. ASVS V2, V5 not applicable. | closed |
| T-04-04 | Spoofing | POST /api/questions | accept | No auth on question creation. Acceptable for local-only deployment. | closed |
| T-04-05 | Denial of Service | POST /api/questions/upload-csv | accept | Large file upload could consume memory. FastAPI UploadFile uses spooled temp files. Single admin user. ASVS V12 not applicable. | closed |
| T-04-06 | Tampering | CSV content validation | mitigate | Backend validates every row: answer must be integer 0-1M, text non-empty, category max 255 chars. Invalid rows skipped with descriptive errors. SQLAlchemy parameterized queries prevent SQL injection. | closed |
| T-04-07 | Spoofing | CSV formula injection | mitigate | React renders question text as plain text nodes via JSX string interpolation, not `dangerouslySetInnerHTML`. No spreadsheet context for formula execution. | closed |
| T-04-SC | Tampering | npm/pip dependencies | mitigate | No new packages introduced in any of the 3 sub-plans. All dependencies were already installed and verified in Phase 01. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-04-01 | T-04-01 | No auth on GET /api/stats — game count is non-sensitive public data in a local WiFi booth environment | Plan 04-01 threat model | 2026-06-10 |
| R-04-02 | T-04-02 | No auth on WebSocket admin commands — local WiFi booth, first-connect-wins admin slot, single game at a time | Plan 04-01 threat model | 2026-06-10 |
| R-04-03 | T-04-03 | No auth on DELETE /api/questions/{id} — local WiFi booth, single admin user, questions are non-sensitive game content | Plan 04-02 threat model | 2026-06-10 |
| R-04-04 | T-04-04 | No auth on POST /api/questions — same rationale as R-04-03 | Plan 04-02 threat model | 2026-06-10 |
| R-04-05 | T-04-05 | Large CSV file DoS — FastAPI UploadFile spools to temp files, single admin user on local network mitigates practical risk | Plan 04-03 threat model | 2026-06-10 |

---

## Mitigation Verification

| Threat ID | Mitigation | Verification Method | Verified |
|-----------|------------|---------------------|----------|
| T-04-06 | CSV row validation + SQLAlchemy parameterized queries | Code review: `backend/services/question_service.py` csv_import method validates answer range (0-1M), non-empty text, category length; all DB writes use SQLAlchemy ORM | ✅ |
| T-04-07 | Plain text rendering, no dangerouslySetInnerHTML | Code review: CsvImportTab.tsx renders all text as JSX children; no .innerHTML or dangerouslySetInnerHTML in any admin component | ✅ |
| T-04-SC | No new packages | Diff review: no changes to frontend/package.json or backend/requirements.txt in any of the 3 plan commits | ✅ |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-11 | 8 | 8 | 0 | gsd-security-auditor (Claude Opus 4.8) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-11
