// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { ApplicationListView } from '../ApplicationListView';
import { Application } from '@/types';

afterEach(() => {
  cleanup();
});

const mockApplications: Application[] = [
  {
    application_id: 'app-1',
    company_name: 'Acme Corp',
    job_title: 'Senior Frontend Engineer',
    application_status: 'Applied',
    location: 'Remote',
    work_mode: 'Remote',
    employment_type: 'FullTime',
    date_applied: '2026-10-15',
    match_score: 88,
    is_favorite: true,
    created_at: '2026-10-15T10:00:00Z',
    updated_at: '2026-10-15T10:00:00Z',
  },
  {
    application_id: 'app-2',
    company_name: 'Starlight Inc',
    job_title: 'Full Stack Developer',
    application_status: 'Interview',
    location: 'New York, NY',
    work_mode: 'Hybrid',
    employment_type: 'FullTime',
    date_applied: '2026-10-20',
    match_score: 92,
    is_favorite: false,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
  },
];

const mockManyApplications: Application[] = Array.from({ length: 25 }, (_, i) => ({
  application_id: `app-${i + 1}`,
  company_name: `Company ${i + 1}`,
  job_title: `Engineer ${i + 1}`,
  application_status: 'Applied',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}));

describe('ApplicationListView', () => {
  it('renders application items with company names and job titles', () => {
    const handleView = vi.fn();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ApplicationListView
        applications={mockApplications}
        onView={handleView}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    );

    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('Senior Frontend Engineer')).toBeDefined();
    expect(screen.getByText('Starlight Inc')).toBeDefined();
    expect(screen.getByText('Full Stack Developer')).toBeDefined();
  });

  it('allows toggling between grouped and flat list mode', () => {
    render(
      <ApplicationListView
        applications={mockApplications}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Grouped by Stage/i });
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /Flat List/i })).toBeDefined();
  });

  it('supports scroll loading in flat list mode when items exceed initial batch', () => {
    render(
      <ApplicationListView
        applications={mockManyApplications}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Switch to flat mode
    const toggleBtn = screen.getByRole('button', { name: /Grouped by Stage/i });
    fireEvent.click(toggleBtn);

    // Initial batch is 15 items: Company 1 is rendered, Company 25 is not yet rendered
    expect(screen.getByText('Company 1')).toBeDefined();
    expect(screen.queryByText('Company 25')).toBeNull();

    // Scroll loader sentinel exists
    expect(screen.getByText(/Scroll down for more/i)).toBeDefined();
  });
});
