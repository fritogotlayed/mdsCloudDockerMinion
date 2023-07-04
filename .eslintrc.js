// eslint-disable-next-line no-undef
module.exports = {
  env: {
    es2021: true,
    'jest/globals': true,
  },
  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:jest/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    // ecmaVersion: 2018,
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off', // TODO: remove rule about no explicit any
    'jest/valid-title': 'off',
    'no-underscore-dangle': 'off',
    'max-len': [
      'error',
      100,
      2,
      {
        ignoreUrls: true,
        ignoreComments: true,
        ignoreRegExpLiterals: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
      },
    ],
  },
  overrides: [
    {
      files: ['src/clients/notification-service.ts'],
      rules: {
        '@typescript-eslint/ban-types': 'error',
      },
    },
    {
      // the "module" on "module.exports" is undefined so disable it until a proper fix is determined
      files: ['./config/**.js'],
      rules: {
        'no-undef': 0,
      },
    },
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
};
