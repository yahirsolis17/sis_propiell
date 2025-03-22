/* /C:/Users/Yahir/sis_propiell/backend/frontend/tailwind.config.js */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.appearance-none': {
          'appearance': 'none',
          '-webkit-appearance': 'none',
          '-moz-appearance': 'none'
        },
        '.print-color-adjust-exact': {
          'print-color-adjust': 'exact',
          '-webkit-print-color-adjust': 'exact'
        }
      })
    }
  ]
}