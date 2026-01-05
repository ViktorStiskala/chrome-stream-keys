import js from '@eslint/js';
import eslintPluginAstro from 'eslint-plugin-astro';
import tailwindCanonicalClasses from 'eslint-plugin-tailwind-canonical-classes';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,astro}'],
    plugins: {
      'tailwind-canonical-classes': tailwindCanonicalClasses,
    },
    rules: {
      'tailwind-canonical-classes/tailwind-canonical-classes': [
        'error',
        {
          cssPath: './src/styles/global.css',
        },
      ],
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['dist/', 'node_modules/', '.astro/'],
  },
];
