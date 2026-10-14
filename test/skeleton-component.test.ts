/**
 * @file skeleton-component.test.ts
 * @description Unit tests for the Skeleton loading placeholder primitive component.
 * @architecture Validates React DOM element structure, accessibility attributes, Tailwind styling, and twMerge class overrides for web/src/components/ui/Skeleton.tsx.
 * @agent_note Run via `pnpm run test:skeleton`. Tests run directly in Node via tsx using plain element props inspection without requiring a full browser DOM.
 */

import assert from 'node:assert';
import { Skeleton } from '../web/src/components/ui/Skeleton';

console.log('Testing Skeleton component primitive...');

// 1. Tag rendering
const defaultElement = Skeleton({});
assert.strictEqual(defaultElement.type, 'div', 'Skeleton should render a div element');

// 2. aria-hidden attribute for accessibility
assert.strictEqual(
  defaultElement.props['aria-hidden'],
  'true',
  'Skeleton must have aria-hidden="true" set for accessibility'
);

// 3. Default design system classes
const defaultClasses: string = defaultElement.props.className;
assert.ok(defaultClasses.includes('animate-pulse'), 'Skeleton should include animate-pulse class');
assert.ok(defaultClasses.includes('rounded-md'), 'Skeleton should include rounded-md class by default');
assert.ok(
  defaultClasses.includes('bg-slate-200/70'),
  'Skeleton should include bg-slate-200/70 class for light mode'
);
assert.ok(
  defaultClasses.includes('dark:bg-slate-800'),
  'Skeleton should include dark:bg-slate-800 class for dark mode'
);

// 4. Custom className merging and twMerge override
const customElement = Skeleton({ className: 'h-10 w-48 rounded-2xl shadow-sm' });
const customClasses: string = customElement.props.className;
assert.ok(customClasses.includes('h-10'), 'Custom height h-10 should be merged');
assert.ok(customClasses.includes('w-48'), 'Custom width w-48 should be merged');
assert.ok(customClasses.includes('rounded-2xl'), 'Custom radius rounded-2xl should override default');
assert.ok(!customClasses.includes('rounded-md'), 'Default rounded-md should be overridden by twMerge');
assert.ok(customClasses.includes('shadow-sm'), 'Custom shadow class should be preserved');

// 5. Arbitrary HTML attributes passed through
const elementWithProps = Skeleton({
  id: 'test-skeleton',
  'data-testid': 'custom-skeleton',
  style: { opacity: 0.8 },
});
assert.strictEqual(elementWithProps.props.id, 'test-skeleton', 'id prop passed through');
assert.strictEqual(
  elementWithProps.props['data-testid'],
  'custom-skeleton',
  'data-testid prop passed through'
);
assert.deepStrictEqual(
  elementWithProps.props.style,
  { opacity: 0.8 },
  'style prop passed through'
);

console.log('All Skeleton primitive tests passed successfully!');
