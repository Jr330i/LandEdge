import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Too strict for common data-fetch / reset patterns; triggers false positives on fetch helpers.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
  {
    files: ['src/components/DashboardUi.tsx', 'src/dashboard/context.tsx'],
    rules: {
      // Shared helpers + context alongside components is intentional here.
      'react-refresh/only-export-components': 'off',
    },
  },
])
