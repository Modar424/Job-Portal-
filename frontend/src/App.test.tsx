import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, Pagination } from './components/ui';
import { formatSalary, initials, validateEmail, validatePassword } from './utils';
import { Avatar, Stars } from './components/ui';

describe('utils', () => {
  it('formats salaries', () => {
    expect(formatSalary(60000, 80000)).toBe('$60k – $80k');
    expect(formatSalary(null, null)).toBe('Salary not disclosed');
    expect(formatSalary(50000, null)).toBe('From $50k');
    expect(formatSalary(40000, 60000, 'EUR')).toBe('€40k – €60k');
  });
  it('validates credentials client-side', () => {
    expect(validateEmail('a@b.co')).toBe(true);
    expect(validateEmail('nope')).toBe(false);
    expect(validatePassword('short1')).not.toBeNull();
    expect(validatePassword('longenough1')).toBeNull();
  });
});

describe('components', () => {
  it('renders initials in the avatar and an accessible star rating', () => {
    expect(initials('Amira Hassan')).toBe('AH');
    render(<><Avatar name="Amira Hassan" /><Stars value={3} label="Rating" /></>);
    expect(screen.getByText('AH')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Rating: 3 of 5' })).toBeTruthy();
  });
  it('renders a human-readable status badge', () => {
    render(<Badge value="under_review" />);
    expect(screen.getByText('Under review')).toBeTruthy();
  });
  it('hides pagination for a single page and shows it otherwise', () => {
    const { container, rerender } = render(<Pagination page={1} totalPages={1} onChange={() => undefined} />);
    expect(container.innerHTML).toBe('');
    rerender(<Pagination page={1} totalPages={3} onChange={() => undefined} />);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  });
});
