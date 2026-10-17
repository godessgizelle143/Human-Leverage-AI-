import type { Config } from 'tailwindcss'
import { BRAND, BRAND_GRADIENT } from './lib/brand'

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
        brass: '#a47b32',
        paper: '#f4efe4',
        ink: '#171512',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': BRAND_GRADIENT,
      },
      boxShadow: {
        'glow-pink': `0 10px 40px -8px ${BRAND.pink}73`,
        'glow-gold': `0 0 24px -6px ${BRAND.gold}59`,
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
