import { describe, expect, it } from 'vitest';
import { EMPLOYER_APP_TRANSITIONS, JOB_TRANSITIONS, WITHDRAWABLE, canTransition } from '../src/utils/domain.js';
import { escapeLike } from '../src/utils/http.js';
import { magicMatches } from '../src/middleware/upload.js';
import { jobSchema, passwordSchema, registerSchema } from '../src/modules/schemas.js';

describe('domain rules', () => {
  it('allows only valid job transitions', () => {
    expect(canTransition(JOB_TRANSITIONS, 'draft', 'active')).toBe(true);
    expect(canTransition(JOB_TRANSITIONS, 'draft', 'closed')).toBe(false);
    expect(canTransition(JOB_TRANSITIONS, 'closed', 'draft')).toBe(false);
  });
  it('blocks employer from moving terminal or withdrawn applications', () => {
    for (const s of ['accepted', 'rejected', 'withdrawn']) {
      expect(EMPLOYER_APP_TRANSITIONS[s]).toEqual([]);
    }
    expect(canTransition(EMPLOYER_APP_TRANSITIONS, 'pending', 'withdrawn')).toBe(false);
    expect(canTransition(EMPLOYER_APP_TRANSITIONS, 'pending', 'accepted')).toBe(false);
  });
  it('limits withdrawal to open states', () => {
    expect(WITHDRAWABLE).not.toContain('accepted');
    expect(WITHDRAWABLE).toContain('pending');
  });
});

describe('validation', () => {
  it('rejects weak passwords', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
    expect(passwordSchema.safeParse('goodpass1').success).toBe(true);
  });
  it('does not allow registering as admin', () => {
    const r = registerSchema.safeParse({ email: 'a@b.co', password: 'goodpass1', fullName: 'Al Ex', role: 'admin' });
    expect(r.success).toBe(false);
  });
  it('rejects inverted salary ranges', () => {
    const base = {
      title: 'Engineer', description: 'x'.repeat(30), requirements: 'something', location: 'Remote',
      categoryId: 1, employmentType: 'full_time', experienceLevel: 'mid',
    };
    expect(jobSchema.safeParse({ ...base, salaryMin: 100, salaryMax: 50 }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, salaryMin: 50, salaryMax: 100 }).success).toBe(true);
  });
});

describe('helpers', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
  });
  it('checks file signatures', () => {
    expect(magicMatches(Buffer.from('%PDF-1.7'), '.pdf')).toBe(true);
    expect(magicMatches(Buffer.from('<html>--'), '.pdf')).toBe(false);
    expect(magicMatches(Buffer.from([0x50, 0x4b, 3, 4]), '.docx')).toBe(true);
  });
});

import { normalizeSkills } from '../src/modules/skills.js';
import { csvCell, fillDays } from '../src/utils/series.js';
import { hashToken, newToken } from '../src/utils/security.js';
import { shapeJob } from '../src/utils/sql.js';

describe('skills, csv, series, tokens', () => {
  it('normalises and de-duplicates skills case-insensitively', () => {
    expect(normalizeSkills(['  React ', 'react', 'Node   JS', ''])).toEqual(['React', 'Node JS']);
  });
  it('rejects skills containing commas', () => {
    const base = { title: 'Engineer', description: 'x'.repeat(30), requirements: 'something', location: 'Remote', categoryId: 1, employmentType: 'full_time', experienceLevel: 'mid' };
    expect(jobSchema.safeParse({ ...base, skills: ['a,b'] }).success).toBe(false);
    expect(jobSchema.safeParse({ ...base, skills: ['React', 'Node'] }).success).toBe(true);
    expect(jobSchema.safeParse({ ...base, skills: Array.from({ length: 11 }, (_, i) => `skill${i}`) }).success).toBe(false);
  });
  it('neutralises CSV formula injection and escapes quotes', () => {
    expect(csvCell('=cmd|calc')).toBe(`"'=cmd|calc"`);
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
  });
  it('fills a continuous 30-day series', () => {
    const s = fillDays([], 30);
    expect(s).toHaveLength(30);
    expect(s.every((d) => d.count === 0)).toBe(true);
  });
  it('generates unique 64-char tokens and stable hashes', () => {
    const t = newToken();
    expect(t).toHaveLength(64);
    expect(t).not.toBe(newToken());
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });
  it('shapes job rows (skills array, boolean featured)', () => {
    expect(shapeJob({ skills: 'A,B', featured: 1 })).toMatchObject({ skills: ['A', 'B'], featured: true });
    expect(shapeJob({ skills: null, featured: 0 })).toMatchObject({ skills: [], featured: false });
  });
});
