import type { SVGProps } from 'react';

/**
 * Assento ocupado — silhueta discreta (não é ícone de “utilizador” genérico).
 * Usado para EXTRA / fora da tripulação ativa quando não basta só Lucide `Armchair`.
 */
export function CabinExtraSeatGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      <path
        d="M6 12c0-1.66 1.34-3 3-3h6c1.66 0 3 1.34 3 3v5H6v-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M8 12V9a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12" cy="6.5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
