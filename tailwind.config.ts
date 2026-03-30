import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        input: "var(--color-border)",
        ring: "var(--color-accent)",
        background: "var(--color-bg-primary)",
        foreground: "var(--color-text-primary)",
        primary: {
          DEFAULT: "var(--color-accent)",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "var(--color-bg-secondary)",
          foreground: "var(--color-text-primary)",
        },
        destructive: {
          DEFAULT: "var(--color-danger)",
          foreground: "#FFFFFF",
        },
        muted: {
          DEFAULT: "var(--color-bg-tertiary)",
          foreground: "var(--color-text-secondary)",
        },
        accent: {
          DEFAULT: "var(--color-bg-tertiary)",
          foreground: "var(--color-text-primary)",
        },
        card: {
          DEFAULT: "var(--color-bg-primary)",
          foreground: "var(--color-text-primary)",
        },
        popover: {
          DEFAULT: "var(--color-bg-primary)",
          foreground: "var(--color-text-primary)",
        },
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Noto Sans Arabic", "sans-serif"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
