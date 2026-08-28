"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  className?: string;
  error?: boolean;
  helper?: React.ReactNode;
  label: string;
  minLength?: number;
  onBlur?: () => void;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
};

export function PasswordField({
  autoComplete,
  autoFocus,
  className,
  error = false,
  helper,
  label,
  minLength,
  onBlur,
  onChange,
  required,
  value,
}: PasswordFieldProps) {
  const inputId = useId();
  const helperId = `${inputId}-helper`;
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("form-field", className)}>
      <label htmlFor={inputId}>{label}</label>
      <div className="password-input">
        <input
          aria-describedby={helper ? helperId : undefined}
          aria-invalid={error || undefined}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          id={inputId}
          minLength={minLength}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? (
            <EyeOff aria-hidden="true" size={18} />
          ) : (
            <Eye aria-hidden="true" size={18} />
          )}
        </button>
      </div>
      {helper ? <div id={helperId}>{helper}</div> : null}
    </div>
  );
}
