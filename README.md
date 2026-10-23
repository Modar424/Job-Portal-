# HireNest — Advanced Job Portal

**React 18 + TypeScript + Vite + Tailwind** · **Node.js + Express + TypeScript** · **MySQL 8**

Roles: Job Seeker, Employer, Administrator.

**Candidates:** search with filters (location, category, type, level, skill, salary), relevance/salary sorting, saved jobs, apply with resume + cover letter, status timeline, withdraw, profile/resume, in-app + email notifications, company pages, report listings.
**Employers:** company profile, job CRUD with skills/currency/expiry, applicant **Kanban board** and table, ratings, internal notes, CSV export, analytics (views, conversion, 30-day trend).
**Admins:** analytics dashboards, user management (suspend/unlock/roles), listing moderation and featuring, reports queue, **audit log**.
**Platform:** password reset, email verification, account lockout, change/delete account, structured logging with request IDs, graceful shutdown, CI pipeline.

Requirements: **Node.js 20+** and **MySQL 8** running locally (XAMPP, MySQL Installer, brew or apt all work).
```bash
npm install
npm run setup      # once: creates .env, the database, tables and demo data
npm run dev        # starts backend (:4000) and frontend (:5173) together
```
If your MySQL user has a password, set `DB_USER` / `DB_PASSWORD` in `.env` (created by the first `npm run setup`, which stops with a hint if it cannot connect) and run `npm run setup` again.
Open http://localhost:5173. Demo logins (password `Demo1234!`): `admin@jobportal.test`, `employer1@jobportal.test`, `seeker1@jobportal.test`.
Emails (verification, password reset) are printed in the terminal when `SMTP_HOST` is empty.

## Quality commands
`npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
Database workflow test: `RUN_DB_TESTS=1 npm test -w backend` (against a disposable database).

## Production
See `docs/DEPLOYMENT.md` (build, migrate, start).

## Docs
`docs/ARCHITECTURE.md` · `docs/API.md` · `docs/SECURITY.md` · `docs/DEPLOYMENT.md` · `docs/TESTING.md`
