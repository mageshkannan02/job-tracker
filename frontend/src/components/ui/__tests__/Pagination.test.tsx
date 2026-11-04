// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { Pagination } from '../pagination';

afterEach(() => {
  cleanup();
});

describe('Pagination Component', () => {
  it('renders total items count and page numbers', () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    expect(screen.getByText(/Showing/i)).toBeDefined();
    expect(screen.getByText(/applications/i)).toBeDefined();
    expect(screen.getByLabelText('Page 1')).toBeDefined();
    expect(screen.getByLabelText('Page 2')).toBeDefined();
  });

  it('triggers onPageChange when clicking next and page buttons', () => {
    const handlePageChange = vi.fn();

    render(
      <Pagination
        currentPage={2}
        totalPages={5}
        totalItems={50}
        pageSize={10}
        onPageChange={handlePageChange}
      />
    );

    const nextBtn = screen.getByLabelText('Next page');
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);

    const page1Btn = screen.getByLabelText('Page 1');
    fireEvent.click(page1Btn);
    expect(handlePageChange).toHaveBeenCalledWith(1);
  });
});
