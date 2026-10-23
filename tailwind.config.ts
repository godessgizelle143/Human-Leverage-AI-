import type { Config } from 'tailwindcss'
import { BRAND, BRAND_FONTS, BRAND_GRADIENT, GOLD_GRADIENT } from './lib/brand'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: { ...BRAND },
      },
      fontFamily: {
        body: [...BRAND_FONTS.body],
        // Titles only — body text stays Inter so everything is easy to read.
        display: [...BRAND_FONTS.display],
        // A few accent words only, never full sentences.
        script: [...BRAND_FONTS.script],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': BRAND_GRADIENT,
        'gradient-gold': GOLD_GRADIENT,
      },
      boxShadow: {
        'glow-pink': `0 0 18px ${BRAND.pink}99, 0 10px 48px -6px ${BRAND.pink}80`,
        'glow-gold': `0 0 28px -4px ${BRAND.gold}80`,
      },
      animation: {
        glow: 'glow 2s ease-in-out infinite alternate',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: `0 0 5px ${BRAND.gold}, 0 0 10px ${BRAND.gold}` },
          '100%': { boxShadow: `0 0 20px ${BRAND.pink}, 0 0 30px ${BRAND.pink}` },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
