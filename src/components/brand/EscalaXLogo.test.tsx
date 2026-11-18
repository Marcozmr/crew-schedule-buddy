import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EscalaXLogo } from './EscalaXLogo';

describe('EscalaXLogo', () => {
  it('é uma imagem acessível chamada EscalaX, no tamanho pedido', () => {
    render(<EscalaXLogo size={36} />);
    const logo = screen.getByRole('img', { name: 'EscalaX' });
    expect(logo).toHaveAttribute('width', '36');
    expect(logo).toHaveAttribute('height', '36');
  });

  it('dois logos na mesma tela não dividem o mesmo degradê', () => {
    render(
      <>
        <EscalaXLogo size={36} />
        <EscalaXLogo size={64} />
      </>,
    );
    const ids = Array.from(document.querySelectorAll('linearGradient')).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });
});
