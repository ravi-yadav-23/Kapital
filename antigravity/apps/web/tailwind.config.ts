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
        // Brand
        brand: {
          from: "#3b82f6",
          to:   "#6366f1",
          DEFAULT: "#6366f1",
        },
        // Surface layers
        surface: {
          base:     "#080c14",
          DEFAULT:  "#0d1220",
          elevated: "#131929",
          card:     "#161e2e",
        },
        // Accent palette
        accent: {
          green:  "#22d3a5",
          red:    "#f43f5e",
          amber:  "#fbbf24",
          blue:   "#60a5fa",
          purple: "#a78bfa",
          cyan:   "#22d3ee",
        },
        // Text
        text: {
          primary:   "#f1f5f9",
          secondary: "#94a3b8",
          muted:     "#828fa3",
          accent:    "#818cf8",
        },
        // Score tiers
        score: {
          strong:   "#22d3a5",
          moderate: "#60a5fa",
          watch:    "#fbbf24",
          avoid:    "#f43f5e",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["Inter", "sans-serif"],
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
        card:  "0 4px 24px rgba(0,0,0,0.4)",
        glow:  "0 0 40px rgba(99,102,241,0.15)",
        green: "0 0 20px rgba(34,211,165,0.2)",
        red:   "0 0 20px rgba(244,63,94,0.2)",
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
