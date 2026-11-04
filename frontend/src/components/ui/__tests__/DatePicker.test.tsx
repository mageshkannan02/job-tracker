// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DatePicker } from '../date-picker';
import { CustomCalendar } from '../custom-calendar';

describe('CustomCalendar & DatePicker', () => {
  it('renders CustomCalendar with month and days', () => {
    render(<CustomCalendar value="2026-11-04" />);
    expect(screen.getByText('November')).toBeDefined();
    expect(screen.getByText('Today')).toBeDefined();
    expect(screen.getByText('Tomorrow')).toBeDefined();
    expect(screen.getByText('Yesterday')).toBeDefined();
  });

  it('renders DatePicker with formatted date and placeholder', () => {
    const { rerender } = render(
      <DatePicker value="" placeholder="Pick a date" />
    );
    expect(screen.getByText('Pick a date')).toBeDefined();

    rerender(<DatePicker value="2026-11-04" placeholder="Pick a date" />);
    expect(screen.getByText('Nov 4, 2026')).toBeDefined();
  });
});
