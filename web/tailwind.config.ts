import type { Config } from 'tailwindcss'

/**
 * Paleta Usecortex — alinhada ao brandbook oficial (maio/2026).
 *
 * 8 cores do brandbook:
 *   Azul Marinho  #0B1324  → ink-900   (texto principal, fundo escuro)
 *   Cinza Frio    #6B7280  → ink-500   (texto secundário)
 *   Verde Brilhante #22C55E → brand-500 (saúde do sistema, OK, ações primárias)
 *   Verde Escuro  #0F5132  → brand-900 (profundidade, hover de CTA verde)
 *   Violeta Inteligência #7C3AED → mind-500 (Cortex IA, elementos cognitivos)
 *   Lilás Claro   #EDE9FE  → mind-100  (fundo de cards do Cortex)
 *   Dourado       #D4AF37  → gold-500  (gamificação, conquistas, ranking)
 *   Rosé          #E7A1AC  → rose-500  (alertas suaves, NPS, humanização)
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Playfair Display"', 'Georgia', 'serif'], // headlines do brandbook
      },
      colors: {
        // Azul marinho oficial — base de tudo que é texto/fundo
        ink: {
          DEFAULT: '#0B1324',
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#6B7280', // cinza frio do brandbook
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0B1324', // azul marinho oficial
        },
        // Verde brilhante + verde escuro (saúde do sistema)
        brand: {
          DEFAULT: '#22C55E',
          50:  '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          400: '#4ADE80',
          500: '#22C55E', // verde brilhante oficial
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#0F5132', // verde escuro oficial
        },
        // Violeta inteligência + lilás claro (Cortex IA)
        mind: {
          DEFAULT: '#7C3AED',
          50: '#F5F3FF',
          100: '#EDE9FE', // lilás claro oficial
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#7C3AED', // violeta oficial
          600: '#6D28D9',
          700: '#5B21B6',
          800: '#4C1D95',
          900: '#3B0F77',
        },
        // Dourado (gamificação)
        gold: {
          DEFAULT: '#D4AF37',
          50:  '#FBF7E8',
          100: '#F6EBC2',
          400: '#E0C158',
          500: '#D4AF37', // dourado oficial
          600: '#B8932A',
          700: '#8E711F',
          900: '#4A3B0F',
        },
        // Rosé (alertas suaves, humanização)
        rose: {
          DEFAULT: '#E7A1AC',
          50:  '#FDF2F4',
          100: '#FBE4E8',
          400: '#EFB5BD',
          500: '#E7A1AC', // rosé oficial
          600: '#D4818E',
          700: '#B05D6B',
          900: '#5F2A33',
        },
      },
      borderRadius: {
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
  plugins: [],
}
export default config
