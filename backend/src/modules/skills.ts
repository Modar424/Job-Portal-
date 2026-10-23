import { type Runner, exec } from '../db/pool.js';

export function normalizeSkills(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of list) {
    const n = s.trim().replace(/\s+/g, ' ');
    const k = n.toLowerCase();
    if (n && !seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

export async function setJobSkills(jobId: number, names: string[], c: Runner) {
  await exec('DELETE FROM job_skills WHERE job_id = ?', [jobId], c);
  for (const n of normalizeSkills(names)) {
    const r = await exec('INSERT INTO skills (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)', [n], c);
    await exec('INSERT IGNORE INTO job_skills (job_id, skill_id) VALUES (?, ?)', [jobId, r.insertId], c);
  }
}
