"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

// ============================================================
// 类型
// ============================================================

type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
type ButtonSize = "sm" | "md" | "lg";
type ButtonState = "default" | "success" | "disabled";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  buttonState?: ButtonState;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

// ============================================================
// 样式映射
// ============================================================

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--color-brand-primary)] text-[var(--color-text-inverse)] hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.97]",
  secondary:
    "bg-[var(--card-bg)] text-[var(--color-brand-secondary)] border border-[var(--color-brand-secondary)] hover:bg-[--surface-fabric-hover] active:scale-[0.97]",
  ghost:
    "bg-transparent text-[var(--color-brand-secondary)] hover:bg-[var(--color-brand-primary-light)] active:scale-[0.97]",
  icon:
    "bg-transparent text-[var(--color-brand-secondary)] rounded-full hover:bg-[var(--color-brand-primary-light)] h-10 w-10 p-0 items-center justify-center active:scale-[0.93]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1",
  md: "h-10 px-4 text-sm gap-1.5",
  lg: "h-12 px-6 text-base gap-2",
};

const stateStyles: Record<ButtonState, string> = {
  default: "",
  success:
    "!bg-[var(--color-success)] !text-[var(--color-text-inverse)] !border-[var(--color-success)]",
  disabled: "opacity-50 cursor-not-allowed pointer-events-none",
};

// ============================================================
// 组件
// ============================================================

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      buttonState = "default",
      iconLeft,
      iconRight,
      loading,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const isIconOnly = variant === "icon";
    const baseStyle =
      "inline-flex items-center justify-center font-medium rounded-[var(--radius-md)] transition-all duration-150 select-none";

    return (
      <button
        ref={ref}
        disabled={disabled || buttonState === "disabled"}
        className={[
          baseStyle,
          isIconOnly ? variantStyles.icon : [variantStyles[variant], sizeStyles[size]],
          stateStyles[buttonState],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : (
          <>
            {iconLeft}
            {!isIconOnly && children}
            {iconRight}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize, ButtonState };
