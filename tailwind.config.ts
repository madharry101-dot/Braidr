import type { Config } from "tailwindcss";

// Breakpoints match PRD 6.3 exactly (xs 480 / sm — / md 768 / lg 1024 / xl 1280).
// Tailwind's default `sm` is 640; Braidr overrides the whole scale so class
// names read the same as the PRD's layout table.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    screens: {
      xs: "480px",
      sm: "600px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
    },
    extend: {
      colors: {
        cream: "var(--color-cream)",
        surface: "var(--color-surface)",
        plum: {
          DEFAULT: "var(--color-plum)",
          hover: "var(--color-plum-hover)",
        },
        slate: "var(--color-slate)",
        mist: "var(--color-mist)",
        gold: {
          DEFAULT: "var(--color-gold)",
          deep: "var(--color-gold-deep)",
        },
        teal: {
          DEFAULT: "var(--color-teal)",
          deep: "var(--color-teal-deep)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          bg: "var(--color-danger-bg)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "Cambria", "serif"],
      },
      maxWidth: {
        content: "72rem",
      },
    },
  },
  plugins: [],
};
export default config;
