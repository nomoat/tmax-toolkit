import reactPlugin from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tsParser from '@typescript-eslint/parser';

export default [
    {
        files: ['sources/**/*.{ts,tsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
                ecmaFeatures: {
                    jsx: true,
                },
            },
        },
        plugins: {
            'react': reactPlugin,
            'react-hooks': reactHooks,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            // ============================================================
            // React Hooks Rules (Critical for preventing bugs)
            // ============================================================

            // Ensures hooks are called in the same order every render
            // Violations cause unpredictable behavior and state bugs
            'react-hooks/rules-of-hooks': 'error',

            // Warns about missing dependencies in useCallback/useMemo/useEffect
            // Missing deps cause stale closures; extra deps cause unnecessary re-renders
            'react-hooks/exhaustive-deps': 'warn',

            // ============================================================
            // React Best Practices
            // ============================================================

            // Prevent missing key prop in iterators
            'react/jsx-key': ['error', { checkFragmentShorthand: true }],

            // Prevent usage of dangerous JSX properties
            'react/no-danger': 'warn',

            // Prevent direct mutation of this.state (class components)
            'react/no-direct-mutation-state': 'error',

            // Prevent usage of deprecated methods
            'react/no-deprecated': 'warn',

            // Prevent duplicate props in JSX
            'react/jsx-no-duplicate-props': 'error',

            // Disallow undeclared variables in JSX
            'react/jsx-no-undef': 'error',

            // Prevent React to be incorrectly marked as unused
            'react/jsx-uses-react': 'off', // Not needed with React 17+ JSX transform

            // Prevent variables used in JSX to be incorrectly marked as unused
            'react/jsx-uses-vars': 'error',

            // Prevent passing of children as props
            'react/no-children-prop': 'warn',

            // Prevent usage of unknown DOM property
            'react/no-unknown-property': ['error', { ignore: ['hitSlop'] }],

            // Enforce that components have a displayName for debugging
            // Disabled: React.memo with named function already provides this
            'react/display-name': 'off',

            // Prevent missing props validation - disabled for TypeScript projects
            'react/prop-types': 'off',

            // ============================================================
            // Performance Best Practices
            // ============================================================

            // Prevent inline function definitions in JSX props
            // These create new function instances on every render
            // Note: Can be overly strict, so set to warn
            'react/jsx-no-bind': ['warn', {
                ignoreDOMComponents: true,
                ignoreRefs: true,
                allowArrowFunctions: true, // Allow for simple callbacks
                allowFunctions: false,
                allowBind: false,
            }],

            // Prevent creating unstable nested components
            // Inner components get remounted on every parent render
            'react/no-unstable-nested-components': ['warn', {
                allowAsProps: true,
            }],
        },
    },
    {
        ignores: [
            'node_modules/**',
            'android/**',
            'ios/**',
            '.expo/**',
            'packages/**',
            '**/*.d.ts',
            // Ignore JS files with JSX that need different parsing
            'sources/components/markdown/markdown-display/**',
            // Ignore trash/example files
            'sources/trash/**',
        ],
    },
];
