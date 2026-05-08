import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#0a0a0a",
          900: "#0a0a0a",
          700: "#3f3f46",
          500: "#71717a",
          300: "#d4d4d8",
        },
        accent: { DEFAULT: "#2563eb", muted: "#dbeafe" },
        good: { DEFAULT: "#16a34a", muted: "#dcfce7" },
        warn: { DEFAULT: "#d97706", muted: "#fef3c7" },
        bad: { DEFAULT: "#dc2626", muted: "#fee2e2" },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.05)",
        elevated: "0 8px 24px -8px rgb(0 0 0 / 0.12), 0 0 0 1px rgb(0 0 0 / 0.05)",
      },
      animation: {
        "pulse-soft": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
