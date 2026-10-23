// End-to-end API flow against a real MySQL database.
// Run: RUN_DB_TESTS=1 npm run migrate && RUN_DB_TESTS=1 npm test  (uses the DB from .env; use a disposable database!)
import request from 'supertest';
import { describe, expect, it } from 'vitest';

const run = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!run)('full workflow (requires MySQL)', async () => {
  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  const tag = Date.now();
  const employer = request.agent(app);
  const seeker = request.agent(app);
  let jobId = 0;
  let appId = 0;

  it('employer registers and publishes a job', async () => {
    const r = await employer.post('/api/auth/register').send({
      email: `emp${tag}@t.co`, password: 'Passw0rd!x', fullName: 'Emp One', role: 'employer', companyName: `Co ${tag}`,
    });
    expect(r.status).toBe(201);
    const j = await employer.post('/api/employer/jobs').send({
      title: `Engineer ${tag}`, description: 'Build and maintain services for our customers.',
      requirements: 'Node.js', location: 'Berlin', categoryId: 1, salaryMin: 50000, salaryMax: 70000,
      employmentType: 'full_time', experienceLevel: 'mid', publish: true,
    });
    expect(j.status).toBe(201);
    jobId = j.body.data.id;
  });

  it('job is searchable', async () => {
    const r = await request(app).get(`/api/jobs?q=Engineer ${tag}&salaryMin=40000`);
    expect(r.status).toBe(200);
    expect(r.body.data.some((x: { id: number }) => x.id === jobId)).toBe(true);
  });

  it('seeker applies once; duplicate is rejected', async () => {
    await seeker.post('/api/auth/register').send({ email: `s${tag}@t.co`, password: 'Passw0rd!x', fullName: 'Seek Er', role: 'seeker' });
    const pdf = Buffer.from('%PDF-1.4\n%test\n');
    const first = await seeker.post(`/api/seeker/jobs/${jobId}/apply`).field('coverLetter', 'Hi').attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(first.status).toBe(201);
    appId = first.body.data.id;
    const dup = await seeker.post(`/api/seeker/jobs/${jobId}/apply`).field('coverLetter', 'Again').attach('resume', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
    expect(dup.status).toBe(409);
  });

  it('fake file content is rejected', async () => {
    const r = await seeker.post(`/api/seeker/jobs/${jobId}/apply`).attach('resume', Buffer.from('<script>'), { filename: 'x.pdf', contentType: 'application/pdf' });
    expect([400, 409]).toContain(r.status);
  });

  it('employer reviews; another employer cannot', async () => {
    const s = await employer.put(`/api/employer/applications/${appId}/status`).send({ status: 'shortlisted' });
    expect(s.status).toBe(200);
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ email: `emp2${tag}@t.co`, password: 'Passw0rd!x', fullName: 'Emp Two', role: 'employer', companyName: `Other ${tag}` });
    expect((await other.get(`/api/employer/applications/${appId}`)).status).toBe(404);
    expect((await other.get(`/api/files/applications/${appId}/resume`)).status).toBe(404);
  });

  it('seeker sees updated status and notification, then logs out', async () => {
    const a = await seeker.get('/api/seeker/applications');
    expect(a.body.data[0].status).toBe('shortlisted');
    expect((await seeker.get('/api/notifications')).body.data.unread).toBeGreaterThan(0);
    await seeker.post('/api/auth/logout');
    expect((await seeker.get('/api/auth/me')).status).toBe(401);
  });

  it('skill filter, notes, rating, CSV export and reporting work end to end', async () => {
    const upd = await employer.put(`/api/employer/jobs/${jobId}`).send({
      title: `Engineer ${tag}`, description: 'Build and maintain services for our customers.', requirements: 'Node.js',
      location: 'Berlin', categoryId: 1, salaryMin: 50000, salaryMax: 70000, salaryCurrency: 'EUR',
      employmentType: 'full_time', experienceLevel: 'mid', skills: ['Node.js', `Skill${tag}`],
    });
    expect(upd.status).toBe(200);
    const bySkill = await request(app).get(`/api/jobs?skill=Skill${tag}`);
    expect(bySkill.body.data.map((x: { id: number }) => x.id)).toContain(jobId);
    expect((await employer.put(`/api/employer/applications/${appId}/rating`).send({ rating: 4 })).status).toBe(200);
    expect((await employer.post(`/api/employer/applications/${appId}/notes`).send({ note: 'Strong profile' })).status).toBe(201);
    const detail = await employer.get(`/api/employer/applications/${appId}`);
    expect(detail.body.data.rating).toBe(4);
    expect(detail.body.data.notes).toHaveLength(1);
    const csv = await employer.get('/api/employer/applications-export.csv');
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    // a different seeker can report once, but not twice
    const other = request.agent(app);
    await other.post('/api/auth/register').send({ email: `rep${tag}@t.co`, password: 'Passw0rd!x', fullName: 'Rep Orter', role: 'seeker' });
    expect((await other.post(`/api/jobs/${jobId}/report`).send({ reason: 'spam' })).status).toBe(201);
    expect((await other.post(`/api/jobs/${jobId}/report`).send({ reason: 'spam' })).status).toBe(409);
  });

  it('locks an account after repeated failures and supports password reset validation', async () => {
    const victim = request.agent(app);
    await victim.post('/api/auth/register').send({ email: `lock${tag}@t.co`, password: 'Passw0rd!x', fullName: 'Lock Me', role: 'seeker' });
    for (let i = 0; i < 6; i++) await request(app).post('/api/auth/login').send({ email: `lock${tag}@t.co`, password: 'wrong-pass1' });
    const locked = await request(app).post('/api/auth/login').send({ email: `lock${tag}@t.co`, password: 'Passw0rd!x' });
    expect(locked.status).toBe(429);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'a'.repeat(64), password: 'Newpass123' })).status).toBe(400);
  });
});
