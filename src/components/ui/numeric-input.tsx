/**
 * NumericInput — A controlled numeric input that allows empty state during editing.
 * 
 * Solves the problem of inputs forcing 0/1 when user tries to clear the field.
 * The value is stored as string during editing and only parsed on blur/submit.
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface NumericInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  /** The numeric value (can be number or null/undefined for empty) */
  value: number | null | undefined;
  /** Called with the parsed number, or null if field is empty */
  onValueChange: (value: number | null) => void;
  /** Minimum allowed value (applied on blur, not during typing) */
  min?: number;
  /** Maximum allowed value (applied on blur, not during typing) */
  max?: number;
  /** Number of decimal places allowed (default: 2) */
  decimals?: number;
  /** Default value to apply when field is blurred while empty (default: null = stay empty) */
  blurDefault?: number | null;
  /** Allow negative numbers (default: false) */
  allowNegative?: boolean;
}

export function NumericInput({
  value,
  onValueChange,
  min,
  max,
  decimals = 2,
  blurDefault = null,
  allowNegative = false,
  className,
  ...props
}: NumericInputProps) {
  // Internal string state for natural editing
  const [displayValue, setDisplayValue] = React.useState<string>(
    value != null ? String(value) : ''
  );
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync external value → display when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value != null ? String(value) : '');
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Allow empty
    if (raw === '') {
      setDisplayValue('');
      onValueChange(null);
      return;
    }

    // Allow minus sign only if negative allowed
    if (raw === '-' && allowNegative) {
      setDisplayValue('-');
      return;
    }

    // Allow partial decimal input like "3." or "0."
    if (raw.endsWith('.') && raw.split('.').length === 2) {
      setDisplayValue(raw);
      return;
    }

    // Parse and validate
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      setDisplayValue(raw);
      onValueChange(parsed);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);

    if (displayValue === '' || displayValue === '-') {
      if (blurDefault !== null) {
        setDisplayValue(String(blurDefault));
        onValueChange(blurDefault);
      } else {
        onValueChange(null);
      }
      return;
    }

    let parsed = parseFloat(displayValue);
    if (isNaN(parsed)) {
      if (blurDefault !== null) {
        setDisplayValue(String(blurDefault));
        onValueChange(blurDefault);
      } else {
        setDisplayValue('');
        onValueChange(null);
      }
      return;
    }

    // Clamp
    if (min != null && parsed < min) parsed = min;
    if (max != null && parsed > max) parsed = max;

    // Round to decimals
    const factor = Math.pow(10, decimals);
    parsed = Math.round(parsed * factor) / factor;

    setDisplayValue(String(parsed));
    onValueChange(parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      className={cn(className)}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
    />
  );
}

/**
 * Safe numeric parsing helper for form submission.
 * Returns the number or a fallback if the value is empty/null.
 */
export function safeParseNumber(value: number | null | undefined, fallback: number = 0): number {
  return value != null && !isNaN(value) ? value : fallback;
}
