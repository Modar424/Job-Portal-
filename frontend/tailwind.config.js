export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#5b5bd6', 600: '#4b4bc4', 700: '#3d3da8', 900: '#23235f' },
        accent: { 500: '#14b8a6', 600: '#0d9488' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
