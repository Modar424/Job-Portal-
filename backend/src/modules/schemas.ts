import { z } from 'zod';
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS } from '../utils/domain.js';

export const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .max(72, 'At most 72 characters')
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number');

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(['seeker', 'employer']),
  companyName: z.string().trim().min(2).max(150).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(72),
});

const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  headline: optText(150),
  phone: optText(40),
  location: optText(150),
  bio: optText(3000),
  skills: optText(500),
});

export const companySchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: optText(5000),
  website: z
    .string()
    .trim()
    .url()
    .max(255)
    .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  location: optText(150),
  industry: optText(100),
  size: optText(50),
});

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'EGP'] as const;
export const skillsSchema = z
  .array(z.string().trim().min(2).max(30).regex(/^[^,]+$/, 'Skills cannot contain commas'))
  .max(10)
  .default([]);

const salary = z.number().int().min(0).max(10_000_000).nullable().optional();

export const jobSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(20).max(10000),
    requirements: z.string().trim().min(5).max(10000),
    location: z.string().trim().min(2).max(150),
    categoryId: z.number().int().positive(),
    salaryMin: salary,
    salaryMax: salary,
    salaryCurrency: z.enum(CURRENCIES).default('USD'),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    experienceLevel: z.enum(EXPERIENCE_LEVELS),
    skills: skillsSchema,
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .refine((d) => d.salaryMin == null || d.salaryMax == null || d.salaryMin <= d.salaryMax, {
    message: 'salaryMin must not exceed salaryMax',
    path: ['salaryMax'],
  });

export const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
};

export const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });
export const resetSchema = z.object({ token: z.string().length(64), password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordSchema });
export const reportSchema = z.object({
  reason: z.enum(['spam', 'scam', 'discriminatory', 'inaccurate', 'other']),
  details: z.string().trim().max(1000).optional(),
});
