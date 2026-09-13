const base = require('./tailwind.config.js')

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...base,
  content: ['./pages/login/*.html', './scripts/login/*.js']
}
