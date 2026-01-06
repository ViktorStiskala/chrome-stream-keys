import { tv } from "tailwind-variants";

export const key = tv({
  slots: {
    root: [
      "inline-flex items-center justify-center",
      "bg-gradient-to-b from-key-bg to-[#151520]",
      "border border-key-border rounded-lg",
      "font-mono font-semibold text-text",
      "transition-all duration-150",
    ],
    shine:
      "absolute inset-0 rounded-lg bg-gradient-to-b from-white/5 to-transparent pointer-events-none",
    wrapper: "flex flex-col items-center gap-2 select-none",
    description: "text-sm text-text-muted text-center",
  },
  variants: {
    size: {
      xs: { root: "min-w-[24px] h-6 px-1.5 text-xs rounded", shine: "rounded" },
      sm: { root: "min-w-[40px] h-[40px] px-3 text-sm" },
      md: { root: "min-w-[56px] h-[56px] px-3 text-base" },
      lg: { root: "min-w-[72px] h-[72px] px-3 text-lg" },
    },
    interactive: {
      true: {
        root: "cursor-pointer hover:border-accent hover:text-accent-bright",
      },
      false: { root: "cursor-default" },
    },
    animate: {
      true: { root: "animate-key-press" },
    },
    wide: {
      true: { root: "px-6" },
    },
  },
  defaultVariants: {
    size: "md",
    interactive: false,
  },
});

export type KeyVariants = Parameters<typeof key>[0];
