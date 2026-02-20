import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0b1220",
        panel: "#111827",
        muted: "#1f2937",
        text: "#e5e7eb",
        accent: "#22d3ee"
      }
    }
  },
  plugins: []
} satisfies Config;
