// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import { KanbanBoard } from '../KanbanBoard';
import { Application } from '@/types';

afterEach(() => {
  cleanup();
});

// Generate 25 mock applications for "Wishlist"
const mockApps: Application[] = Array.from({ length: 25 }, (_, i) => ({
  application_id: `app-${i + 1}`,
  company_name: `Company ${i + 1}`,
  job_title: `Role ${i + 1}`,
  application_status: 'Wishlist',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
}));

describe('KanbanBoard with scroll loading', () => {
  it('renders initial batch and shows scroll loading indicator when more exist', () => {
    render(
      <KanbanBoard
        applications={mockApps}
        onStatusChange={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    // Initial batch is 10, so Company 1 is rendered, but Company 20 is not yet rendered
    expect(screen.getByText('Company 1')).toBeDefined();
    expect(screen.queryByText('Company 20')).toBeNull();

    // Indicates remaining items on scroll
    expect(screen.getByText(/Scroll down for more/i)).toBeDefined();
  });
});
