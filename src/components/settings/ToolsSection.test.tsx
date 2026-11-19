import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolsSection } from './ToolsSection';

describe('ToolsSection', () => {
  it('reúne em Ajustes as ferramentas que saíram do Início', () => {
    render(<MemoryRouter><ToolsSection /></MemoryRouter>);
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/duty-calc', '/rest-calc', '/regulation', '/weather']);
    expect(screen.queryByText(/Pro Board/)).toBeNull();
  });
});
