module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f6f2',
          100: '#ece9e2',
          200: '#d6d0c2',
          300: '#b9b09d',
          400: '#8b816e',
          500: '#6d624f',
          600: '#5a5041',
          700: '#473f33',
          800: '#332e25',
          900: '#1c1914'
        },
        accent: {
          50: '#eef8f6',
          100: '#d7efe9',
          200: '#a8d9cc',
          300: '#76bea9',
          400: '#3e9a7f',
          500: '#2c7f67',
          600: '#236a56',
          700: '#1c5445',
          800: '#153f34',
          900: '#0f2d25'
        },
        sand: {
          50: '#fbf7f0',
          100: '#f3ecdf',
          200: '#e6d8c0',
          300: '#d2bfa0',
          400: '#b39a78',
          500: '#917a5c',
          600: '#7b654a',
          700: '#624f3a',
          800: '#493a2b',
          900: '#31261d'
        }
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui'],
        serif: ['"IBM Plex Serif"', 'ui-serif', 'Georgia']
      },
      boxShadow: {
        soft: '0 18px 45px -32px rgba(28, 25, 20, 0.45)'
      }
    }
  },
  plugins: []
};
