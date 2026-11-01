import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // v2 Primary Semantic Tokens
        canvas: "var(--bg-canvas)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          base: "var(--bg-canvas)",
          elevated: "var(--bg-raised)",
          card: "var(--bg-surface)",
          raised: "var(--bg-raised)",
          selected: "var(--bg-selected)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          ink: "var(--accent-ink)",
          subtle: "rgba(245, 166, 35, 0.08)",
          text: "var(--accent-text)",
        },
        positive: {
          DEFAULT: "var(--positive)",
        },
        negative: {
          DEFAULT: "var(--negative)",
        },

        // Backward compatibility bridges
        brand: {
          from: "var(--accent)",
          to: "var(--accent-hover)",
          DEFAULT: "var(--accent)",
        },
        border: {
          subtle: "var(--line)",
          default: "var(--line)",
          strong: "var(--line-strong)",
        },
        text: {
          primary: "var(--ink)",
          secondary: "var(--ink-2)",
          muted: "var(--ink-3)",
          accent: "var(--accent)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Geist", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["13px", "18px"],
        xs: ["13px", "18px"],
        sm: ["13px", "18px"],
        base: ["15px", "22px"],
        md: ["16px", "24px"],
        lg: ["20px", "28px"],
        xl: ["24px", "32px"],
        "2xl": ["28px", "36px"],
        "3xl": ["32px", "40px"],
        "4xl": ["36px", "44px"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        DEFAULT: "var(--radius-sm)",
      },
      boxShadow: {
        modal: "0 1px 3px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
