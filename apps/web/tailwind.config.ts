import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand (Option A: Premium Amber / Gold)
        brand: {
          from: "#f59e0b",
          to:   "#d97706",
          DEFAULT: "#f59e0b",
        },
        // Surface layers (Option A: Warm Near-Black & Warm Dark Brown-Black)
        surface: {
          base:     "#0c0a09",
          DEFAULT:  "#1a1612",
          elevated: "#241e19",
          card:     "#1a1612",
        },
        // Border palette
        border: {
          subtle:  "#2d2520",
          default: "#3d322b",
          strong:  "#52433a",
        },
        // Accent palette
        accent: {
          green:  "#22c55e",
          red:    "#ef4444",
          amber:  "#f59e0b",
          blue:   "#38bdf8",
          purple: "#c084fc",
          cyan:   "#2dd4bf",
        },
        // Text
        text: {
          primary:   "#fafaf9",
          secondary: "#a8a29e",
          muted:     "#78716c",
          accent:    "#f59e0b",
        },
        // Score tiers
        score: {
          strong:   "#22c55e",
          moderate: "#f59e0b",
          watch:    "#d97706",
          avoid:    "#ef4444",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        heading: ["var(--font-heading)", "DM Sans", "sans-serif"],
        mono: ["var(--font-inter)", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", "15px"],
      },
      borderRadius: {
        sm:  "6px",
        DEFAULT: "8px",
        md:  "10px",
        lg:  "12px",
        xl:  "16px",
        "2xl": "20px",
      },
      boxShadow: {
        card:  "0 4px 24px rgba(0,0,0,0.5)",
        glow:  "0 0 40px rgba(245,158,11,0.18)",
        green: "0 0 20px rgba(34,197,94,0.2)",
        red:   "0 0 20px rgba(239,68,68,0.2)",
        amber: "0 0 20px rgba(245,158,11,0.25)",
      },
      animation: {
        "fade-in":    "fade-in 0.3s ease forwards",
        "slide-left": "slide-in-left 0.25s ease forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "pulse-dot":  "pulse-dot 2s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to:   { opacity: "1", transform: "translateX(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(99,102,241,0.1)" },
          "50%":       { boxShadow: "0 0 30px rgba(99,102,241,0.25)" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%":       { opacity: "0.5", transform: "scale(0.8)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
