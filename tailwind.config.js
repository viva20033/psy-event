/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef4fb',
          100: '#d9e6f5',
          200: '#b8d0eb',
          300: '#8ab3dc',
          400: '#5a91c9',
          500: '#3d74ad',
          600: '#2f5d91',
          700: '#1e3a5f',
          800: '#1a3250',
          900: '#172b43',
        },
        accent: {
          500: '#c4a35a',
          600: '#a8873f',
        },
      },
    },
  },
  plugins: [],
};
