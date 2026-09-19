import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Kept under the old name so existing classes keep working, but the
        // values are the terminal neutrals now — the navy blues are gone.
        navy: {
          950: "#0A0A0A",
          900: "#141414",
          880: "#111111",
          860: "#141414",
          850: "#0D0D0D",
          800: "#262626",
        },
        brand: {
          /** GFXA COMMUNITY green — the one accent. */
          accent: "#00FF88",
          /** Only the member avatar still uses this; it is identity, not brand. */
          blue: "#2A7FFF",
          green: "#00FF88",
          danger: "#FF4D4D",
          silver: "#C0C5CE",
        },
        ink: {
          DEFAULT: "#E5E5E5",
          muted: "#A3A3A3",
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
        glow: "0 0 40px rgba(0,255,136,0.12)",
        "glow-lg": "0 0 80px rgba(0,255,136,0.18)",
        "glow-green": "0 0 40px rgba(0,255,136,0.18)",
      },
      backgroundImage: {
        "navy-fade": "linear-gradient(180deg,#0A0A0A 0%,#0A0A0A 100%)",
        "membership": "linear-gradient(135deg,#141414 0%,#0F1F17 100%)",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.6)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(14px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 2.6s cubic-bezier(0.16,1,0.3,1) infinite",
        riseIn: "riseIn 0.6s cubic-bezier(0.16,1,0.3,1) both",
        ticker: "ticker 48s linear infinite",
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
