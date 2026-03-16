/**
 * Tailwind CSS Configuration Template
 *
 * This is a reference template. Copy to your project root or apps/web/
 * as tailwind.config.ts and adapt content paths and theme to your application.
 *
 * Tailwind CSS is the recommended default for utility-first styling.
 * See implementation-defaults.md for the styling recommendation.
 */

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './apps/web/app/**/*.{ts,tsx}',
    './apps/web/components/**/*.{ts,tsx}',
    './packages/shared/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Add project-specific theme extensions here
    },
  },
  plugins: [],
};

export default config;
