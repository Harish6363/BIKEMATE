/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        bm: {
          sidebar: '#0c1924',
          sidebarActive: '#00b87c',
          sidebarHover: '#142535',
          sidebarText: '#8b9ca8',
          bg: '#f4f8f7',
          card: '#ffffff',
          mintCard: '#eaf7f2',
          mintBorder: '#daf1e8',
          verifiedBg: '#e1f7ec',
          verifiedText: '#00a86b',
          verifiedBorder: '#98e6c4',
          emerald: '#00b87c',
          emeraldHover: '#00a46e',
          textDark: '#111827',
          textMuted: '#6b7280',
        },
        brand: {
          50:  '#f0f4ff',
          100: '#e0eaff',
          200: '#c4d4ff',
          300: '#9ab4ff',
          400: '#6b8eff',
          500: '#00b87c',
          600: '#00a36e',
          700: '#008e60',
          800: '#007550',
          900: '#0c1924',
        },
        dark: {
          900: '#0a0a0f',
          800: '#111118',
          700: '#1a1a28',
          600: '#222235',
          500: '#2d2d48',
        }
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #00b87c 0%, #059669 100%)',
        'gradient-card': 'linear-gradient(145deg, #1a1a28 0%, #222235 100%)',
      },
      boxShadow: {
        'glow': '0 0 30px rgba(0, 184, 124, 0.3)',
        'glow-sm': '0 0 15px rgba(0, 184, 124, 0.2)',
        'card': '0 4px 24px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}
