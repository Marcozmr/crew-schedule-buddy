/**
 * Logo "Órbita" do EscalaX: o avião dentro de uma órbita amarela sobre degradê verde.
 * Mesmo desenho de public/escalax-logo.svg (gerado por scripts/icons/render-icons.mjs).
 */
import { useId } from 'react';

const PLANE =
  'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z';

export function EscalaXLogo({ size, className }: { size: number; className?: string }) {
  const gid = `escalax-g-${useId().replace(/:/g, '')}`;
  return (
    <svg role="img" aria-label="EscalaX" width={size} height={size} viewBox="0 0 512 512" className={className}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22A35A" />
          <stop offset="1" stopColor="#0F5B2E" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gid})`} />
      <circle cx="256" cy="256" r="150" fill="#FFFFFF" fillOpacity="0.08" />
      <path d="M56 256 A200 84 0 0 1 456 256" fill="none" stroke="#FACC15" strokeWidth="16" strokeLinecap="round" transform="rotate(-28 256 256)" />
      <g transform="translate(143 140) scale(9.2)">
        <path d={PLANE} fill="#FFFFFF" stroke="#17803F" strokeWidth="1.4" strokeLinejoin="round" paintOrder="stroke" />
      </g>
      <path d="M56 256 A200 84 0 0 0 456 256" fill="none" stroke="#FACC15" strokeWidth="16" strokeLinecap="round" transform="rotate(-28 256 256)" />
      <circle cx="432" cy="162" r="24" fill="#FACC15" />
    </svg>
  );
}
