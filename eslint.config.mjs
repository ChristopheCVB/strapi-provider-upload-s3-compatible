import { defineConfig } from 'eslint/config'
import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    files: ['**/*.{js,mjs,cjs,ts,cts,mts}'],
  },
  {
    ignores: ['dist'],
  },
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // https://eslint.org/docs/latest/rules/
  pluginJs.configs.recommended,
  // https://typescript-eslint.io/
  ...tseslint.configs.recommended,
  ...tseslint.configs.stylistic,
  {
    rules: {
      // https://eslint.org/docs/latest/rules/
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'no-console': 'warn',
      'comma-dangle': ['error', 'always-multiline'],
      'quotes': ['error', 'single'],
      'semi': ['error', 'never'],
      'no-multiple-empty-lines': ['warn', { 'max': 1 }],
      'require-await': 'warn',
      'eol-last': ['error', 'always'],
      'object-curly-spacing': ['error', 'always'],
      // https://typescript-eslint.io/rules/
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
)
