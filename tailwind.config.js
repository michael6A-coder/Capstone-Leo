/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './pages/**/*.html',
    './scripts/**/*.js',
    './assets/js/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        bronze: 'rgb(var(--c-bronze) / <alpha-value>)',
        copper: {
          DEFAULT: 'rgb(var(--c-copper) / <alpha-value>)',
          pale:    'rgb(var(--c-copper-pale) / <alpha-value>)',
          dark:    'rgb(var(--c-copper-dark) / <alpha-value>)'
        },
        ink:   'rgb(var(--c-ink) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        plum:  'rgb(var(--c-plum) / <alpha-value>)',
        sand: {
          100: 'rgb(var(--c-sand-100) / <alpha-value>)',
          200: 'rgb(var(--c-sand-200) / <alpha-value>)'
        }
      },
      fontFamily: {
        body:    ['Segoe UI', 'Tahoma', 'Verdana', 'Arial', 'sans-serif'],
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif']
      }
    }
  }
}
