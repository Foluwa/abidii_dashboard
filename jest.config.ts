/**
 * Jest configuration for the admin dashboard
 */

import type { Config } from 'jest';

const customJestConfig: Config = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Components like date-picker.tsx import flatpickr's CSS directly
    // (import 'flatpickr/dist/flatpickr.css') - Jest has no loader for raw
    // CSS and fails with "Unexpected token '.'" on the first selector.
    '\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js',
    // src/icons uses SVGR-style default imports (import Icon from
    // "./x.svg" as a React component, via Next.js's webpack SVG loader) -
    // Jest has no equivalent transform and fails parsing raw <svg> markup.
    '\\.svg$': '<rootDir>/__mocks__/svgMock.js',
  },
  transform: {
    '^.+\\.(t|j)sx?$': 'babel-jest',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

export default customJestConfig;
