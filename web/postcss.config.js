/**
 * @file postcss.config.js
 * @description PostCSS configuration enabling Tailwind CSS processing and Autoprefixer.
 * @architecture Pipeline stage for transforming CSS during Vite bundling.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
