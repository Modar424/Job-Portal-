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

