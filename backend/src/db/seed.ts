import { env } from '../config/env.js';
import { exec, one, pool, rows } from './pool.js';
import { hashPassword } from '../utils/security.js';
import { setJobSkills } from '../modules/skills.js';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production');
  process.exit(1);
}

const reset = process.argv.includes('--reset');

const companies = [
  ['Northwind Labs', 'Building developer tools for modern teams.', 'https://example.com/northwind', 'Berlin, Germany', 'Software', '51-200'],
  ['Bluebird Health', 'Digital care for everyday life.', 'https://example.com/bluebird', 'London, UK', 'Healthcare', '201-500'],
  ['Atlas Finance', 'Fintech infrastructure for growing businesses.', 'https://example.com/atlas', 'New York, USA', 'Finance', '51-200'],
] as const;

const jobTemplates = [
  ['Senior Backend Engineer', 'Design and run Node.js services that power our platform. You will own APIs, data models and performance.', '5+ years with Node.js, SQL databases and testing.', 'Software Engineering', 'full_time', 'senior', 85000, 120000],
  ['Frontend Developer', 'Build accessible interfaces with React and TypeScript in a product-focused team.', '3+ years React, TypeScript, CSS.', 'Software Engineering', 'full_time', 'mid', 60000, 85000],
  ['Product Designer', 'Shape end-to-end product experiences from research to polished UI.', 'Portfolio showing shipped product work.', 'Design', 'full_time', 'mid', 55000, 78000],
  ['Marketing Intern', 'Support campaigns, content calendars and analytics reporting.', 'Currently studying marketing or communications.', 'Marketing', 'internship', 'entry', 18000, 24000],
  ['Data Analyst', 'Turn product and customer data into insights that guide decisions.', 'SQL, spreadsheets, and a BI tool of your choice.', 'Data & Analytics', 'full_time', 'mid', 58000, 80000],
  ['Customer Support Specialist', 'Help customers succeed with clear, empathetic communication.', '1+ year in a support role.', 'Customer Support', 'part_time', 'entry', 28000, 38000],
  ['Financial Controller', 'Lead month-end close, reporting and compliance for the finance team.', 'CPA or equivalent and 7+ years experience.', 'Finance', 'full_time', 'lead', 95000, 135000],
  ['Remote QA Engineer', 'Create automated end-to-end tests and improve release quality.', 'Experience with test automation frameworks.', 'Software Engineering', 'remote', 'mid', 52000, 74000],
  ['Sales Development Representative', 'Qualify inbound leads and start conversations with new customers.', 'Excellent written and spoken communication.', 'Sales', 'full_time', 'entry', 35000, 48000],
  ['Registered Nurse (Contract)', 'Provide telehealth nursing support on a rolling 6-month contract.', 'Valid nursing license.', 'Healthcare', 'contract', 'mid', 60000, 72000],
] as const;

async function main() {
  if (reset) {
    for (const t of ['notifications', 'application_notes', 'application_events', 'applications', 'saved_jobs', 'job_reports', 'job_skills', 'jobs', 'skills', 'companies', 'seeker_profiles', 'auth_tokens', 'audit_logs', 'users']) {
      await exec(`DELETE FROM ${t}`);
    }
    console.log('Existing data cleared');
  } else if ((await one<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n > 0) {
    console.log('Users already exist; run with --reset to reseed. Nothing done.');
    return;
  }

  const hash = await hashPassword(env.SEED_PASSWORD);
  const addUser = async (email: string, name: string, role: string) =>
    (await exec('INSERT INTO users (email, password_hash, full_name, role, email_verified_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [email, hash, name, role])).insertId;

  await addUser('admin@jobportal.test', 'Site Admin', 'admin');
  const cats = new Map((await rows<{ id: number; name: string }>('SELECT id, name FROM categories')).map((c) => [c.name, c.id]));

  const companyIds: number[] = [];
  for (const [i, c] of companies.entries()) {
    const uid = await addUser(`employer${i + 1}@jobportal.test`, `${c[0]} Recruiter`, 'employer');
    const r = await exec(
      'INSERT INTO companies (owner_id, name, description, website, location, industry, size) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uid, ...c],
    );
    companyIds.push(r.insertId);
  }

  const skillSets = [
    ['Node.js', 'MySQL', 'TypeScript', 'REST'], ['React', 'TypeScript', 'CSS', 'Accessibility'], ['Figma', 'User research'],
    ['Social media', 'Analytics'], ['SQL', 'Python', 'Tableau'], ['Communication', 'Zendesk'], ['IFRS', 'Excel', 'Reporting'],
    ['Playwright', 'Test automation', 'CI/CD'], ['CRM', 'Outreach'], ['Patient care', 'Telehealth'],
  ];
  const jobIds: number[] = [];
  for (const [i, t] of jobTemplates.entries()) {
    const status = i === 9 ? 'draft' : i === 8 ? 'closed' : 'active';
    const r = await exec(
      `INSERT INTO jobs (company_id, category_id, title, description, requirements, location, salary_min, salary_max,
        employment_type, experience_level, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() - INTERVAL ? DAY)`,
      [companyIds[i % 3], cats.get(t[3]), t[0], t[1], t[2], companies[i % 3]![3], t[6], t[7], t[4], t[5], status, i],
    );
    jobIds.push(r.insertId);
    await setJobSkills(r.insertId, skillSets[i] ?? [], pool);
    if (i === 0 || i === 4) await exec('UPDATE jobs SET featured = 1 WHERE id = ?', [r.insertId]);
  }

  const seekers: number[] = [];
  for (const [i, n] of ['Amira Hassan', 'Lucas Meyer', 'Priya Nair'].entries()) {
    const uid = await addUser(`seeker${i + 1}@jobportal.test`, n, 'seeker');
    await exec('INSERT INTO seeker_profiles (user_id, headline, location, skills) VALUES (?, ?, ?, ?)',
      [uid, ['Full-stack developer', 'UX designer', 'Data analyst'][i], ['Cairo', 'Munich', 'Bangalore'][i], ['React, Node.js, SQL', 'Figma, Research', 'SQL, Python'][i]]);
    seekers.push(uid);
  }

  // A few applications without real files: resume_file points to a name that does not exist on disk.
  const sample = [[0, 0, 'under_review'], [1, 0, 'pending'], [0, 1, 'shortlisted'], [2, 2, 'pending'], [1, 4, 'interview']] as const;
  for (const [s, j, st] of sample) {
    const r = await exec(
      'INSERT INTO applications (job_id, seeker_id, cover_letter, resume_file, resume_name, status) VALUES (?, ?, ?, ?, ?, ?)',
      [jobIds[j], seekers[s], 'I would love to join your team.', 'seed-placeholder.pdf', 'resume.pdf', st],
    );
    await exec('INSERT INTO application_events (application_id, from_status, to_status, actor_id) VALUES (?, NULL, ?, ?)', [r.insertId, 'pending', seekers[s]]);
  }

  console.log(`Seeded. Demo logins: admin@jobportal.test, employer1..3@jobportal.test, seeker1..3@jobportal.test (password from SEED_PASSWORD, default "Demo1234!")`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
