import type { Row } from '../db/pool.js';

/** A listing is publicly visible when published, approved by moderation and not expired. */
export const PUBLIC_JOB =
  "j.status = 'active' AND j.moderation = 'approved' AND (j.expires_at IS NULL OR j.expires_at > UTC_TIMESTAMP())";

export const JOB_CARD = `j.id, j.title, j.location, j.salary_min AS salaryMin, j.salary_max AS salaryMax,
  j.salary_currency AS salaryCurrency, j.employment_type AS employmentType, j.experience_level AS experienceLevel,
  j.status, j.featured, j.views, j.expires_at AS expiresAt, j.created_at AS createdAt,
  c.id AS companyId, c.name AS companyName, cat.name AS category,
  (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ',') FROM job_skills js JOIN skills s ON s.id = js.skill_id
    WHERE js.job_id = j.id) AS skills`;

export function shapeJob(r: Row): Row {
  return { ...r, featured: !!r.featured, skills: r.skills ? String(r.skills).split(',') : [] };
}
