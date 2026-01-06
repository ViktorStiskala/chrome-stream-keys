import { tv } from "tailwind-variants";

export const button = tv({
  base: [
    "inline-flex items-center justify-center gap-2",
    "font-semibold rounded-xl",
    "transition-all duration-200",
  ],
  variants: {
    variant: {
      primary:
        "bg-accent hover:bg-accent-bright text-white hover:scale-105 glow-accent",
      secondary:
        "bg-surface hover:bg-bg-card text-text border border-border hover:border-accent/50",
      ghost: "text-text-muted hover:text-text",
    },
    size: {
      sm: "px-4 py-2 text-sm",
      md: "px-6 py-3 text-base",
      lg: "px-8 py-4 text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

export type ButtonVariants = Parameters<typeof button>[0];
