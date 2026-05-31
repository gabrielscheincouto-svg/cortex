import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 400: '#94A3B8', 500: '#64748B', 700: '#334155', 900: '#0F172A' },
        brand: { DEFAULT: '#10B981', 50: '#ECFDF5', 600: '#059669', 700: '#047857' },
        gold: { 500: '#BA7517', 50: '#FAEEDA' },
      },
    },
  },
  plugins: [],
}
export default config
