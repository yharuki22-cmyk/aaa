import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // 落ち着いた配色（建築材料学の学習に集中できるトーン）
        base: {
          bg: "#f5f3ee",
          surface: "#ffffff",
          ink: "#2b2b2b",
          muted: "#6b6b6b",
          line: "#e2ddd3",
        },
        brand: {
          DEFAULT: "#5b6b52", // 落ち着いたオリーブ/セージグリーン
          dark: "#43503c",
          light: "#8a9a80",
        },
        correct: "#2f855a",
        incorrect: "#c53030",
      },
    },
  },
  plugins: [],
};

export default config;
