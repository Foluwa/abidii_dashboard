/**
 * Jest setup file
 */

import '@testing-library/jest-dom';

// jsdom lacks the pointer-capture and scrolling APIs Radix Select/Popover
// call when opening a menu; stub them so the real components can be driven
// in tests.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.scrollIntoView) proto.scrollIntoView = () => {};
}
import type { ReactNode } from 'react';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
jest.mock('next/link', () => {
  const React = require('react');
  function MockNextLink({ children, href }: { children: ReactNode; href: string }) {
    return React.createElement('a', { href }, children);
  }
  return MockNextLink;
});

// Mock next/image
jest.mock('next/image', () => {
  const React = require('react');
  function MockNextImage({ alt, ...props }: { alt?: string } & Record<string, unknown>) {
    return React.createElement('img', { alt: alt ?? '', ...props });
  }
  return MockNextImage;
});

// Mock SWR
jest.mock('swr', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// Suppress console errors in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
