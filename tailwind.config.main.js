const base = require('./tailwind.config.js')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: ['./index.html', './assets/js/main.js']
}
