/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef2f9',
          100: '#dde5f3',
          200: '#bccce7',
          300: '#9ab3db',
          400: '#7999ce',
          500: '#5780c2',
          600: '#3b5fa0',  // primary
          700: '#2d4a7a',  // header / dark
          800: '#1e3254',
          900: '#101b2e',
        },
      },
    },
  },
  plugins: [],
};
