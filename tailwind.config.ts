import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#070A12",
          900: "#0A1931",
          880: "#0B1426",
          860: "#101626",
          850: "#080C18",
          800: "#143D7A",
        },
        brand: {
          blue: "#2A7FFF",
          green: "#00D094",
          danger: "#FF4D4D",
          silver: "#C0C5CE",
        },
        ink: {
          DEFAULT: "#E6EAF2",
          muted: "#8A93A8",
        },
        hair: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        headline: "-0.03em",
        kicker: "0.2em",
      },
      boxShadow: {
        glow: "0 0 40px rgba(42,127,255,0.15)",
        "glow-lg": "0 0 80px rgba(42,127,255,0.22)",
        "glow-green": "0 0 40px rgba(0,208,148,0.18)",
      },
      backgroundImage: {
        "navy-fade": "linear-gradient(180deg,#070A12 0%,#0A1931 100%)",
        "membership": "linear-gradient(135deg,#0A1931 0%,#143D7A 100%)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.6s cubic-bezier(0.16,1,0.3,1) infinite",
        riseIn: "riseIn 0.6s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 1.6s infinite",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
