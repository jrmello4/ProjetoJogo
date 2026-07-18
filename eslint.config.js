import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        indexedDB: 'readonly',
        fetch: 'readonly',
        requestAnimationFrame: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        Image: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        performance: 'readonly',
        THREE: 'readonly',
        rive: 'readonly',
        gsap: 'readonly',
        location: 'readonly',
        cancelAnimationFrame: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        queueMicrotask: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-const-assign': 'error',
      'no-fallthrough': 'error',
      'no-case-declarations': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    // server.js e scripts/ rodam em Node puro (não no browser) — precisam
    // dos globals do Node em vez dos globals de browser acima.
    files: ['server.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      }
    }
  }
];
