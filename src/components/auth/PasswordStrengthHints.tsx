import { evaluatePasswordStrength } from "@/lib/auth/passwordPolicy";

type Props = {
  password: string;
  className?: string;
};

/**
 * Checklist visual em tempo real para política de senha forte.
 */
export function PasswordStrengthHints({ password, className }: Props) {
  const { checks } = evaluatePasswordStrength(password);

  const items: { ok: boolean; label: string }[] = [
    { ok: checks.minLength, label: "Pelo menos 8 caracteres" },
    { ok: checks.hasUpper, label: "Uma letra maiúscula" },
    { ok: checks.hasLower, label: "Uma letra minúscula" },
    { ok: checks.hasDigit, label: "Um número" },
    { ok: checks.hasSpecial, label: "Um caractere especial (!@#$…)" },
  ];

  return (
    <ul className={className ?? "mt-2 space-y-1 text-xs text-white/60"}>
      {items.map((row) => (
        <li key={row.label} className={row.ok ? "text-emerald-300/90" : undefined}>
          {row.ok ? "✓ " : "○ "}
          {row.label}
        </li>
      ))}
    </ul>
  );
}
