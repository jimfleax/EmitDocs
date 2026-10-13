import assert from 'node:assert';
import React from 'react';
import { getReactNodeText } from '../web/src/lib/utils';
import {
  extractItemsFromChildren,
  selectItemCache,
  registerSelectLabels,
} from '../web/src/lib/select-utils';
import {
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '../web/src/components/ui/select';

console.log('Testing getReactNodeText helper...');

// 1. Primitive string, number, null, undefined, boolean
assert.strictEqual(getReactNodeText('Hello'), 'Hello');
assert.strictEqual(getReactNodeText(123), '123');
assert.strictEqual(getReactNodeText(null), '');
assert.strictEqual(getReactNodeText(undefined), '');
assert.strictEqual(getReactNodeText(false), '');
assert.strictEqual(getReactNodeText(true), '');

// 2. Array of strings (FieldPropertiesPanel JSX pattern)
const arrayChildren = ['{{', 'customer_name', '}} (', 'Text', ')'];
assert.strictEqual(getReactNodeText(arrayChildren), '{{customer_name}} (Text)');

// 3. React elements
const elementChildren = React.createElement('span', null, 'Nested text');
assert.strictEqual(getReactNodeText(elementChildren), 'Nested text');

// 4. Mixed nested elements and arrays
const mixedChildren = [
  'Prefix: ',
  React.createElement('strong', null, 'Bold text'),
  ' (suffix)',
];
assert.strictEqual(getReactNodeText(mixedChildren), 'Prefix: Bold text (suffix)');

console.log('Testing Select synchronous label extraction...');

// 5. Synchronous extraction from Select JSX structure (Frame 1 resolution)
const selectChildren = [
  React.createElement(SelectTrigger, null, React.createElement(SelectValue, { placeholder: 'Select font...' })),
  React.createElement(
    SelectContent,
    null,
    React.createElement(SelectItem, { value: 'Helvetica' }, 'Helvetica (Standard)'),
    React.createElement(SelectItem, { value: 'Times-Roman' }, 'Times Roman'),
    React.createElement(SelectItem, { value: 'Courier' }, 'Courier')
  ),
];

const extracted = extractItemsFromChildren(selectChildren);
assert.strictEqual(extracted.get('Helvetica')?.text, 'Helvetica (Standard)');
assert.strictEqual(extracted.get('Times-Roman')?.text, 'Times Roman');
assert.strictEqual(extracted.get('Courier')?.text, 'Courier');
assert.strictEqual(extracted.get('NonExistent'), undefined);

// 6. Extraction with textValue override
const complexChildren = [
  React.createElement(
    SelectContent,
    null,
    React.createElement(
      SelectItem,
      { value: 'field-1', textValue: '{{full_name}} (Text)' },
      React.createElement('span', null, '{{full_name}} (Text)')
    )
  ),
];
const extractedComplex = extractItemsFromChildren(complexChildren);
assert.strictEqual(extractedComplex.get('field-1')?.label, '{{full_name}} (Text)');
assert.strictEqual(extractedComplex.get('field-1')?.text, '{{full_name}} (Text)');

// 7. Static item cache and registration
registerSelectLabels({
  'shrink-to-fit': 'Single-line Fit-then-flag (Auto-shrink to min bound)',
  'multi-line': 'Multi-line Auto-wrap (Wrap text within box)',
});
assert.strictEqual(selectItemCache.get('shrink-to-fit')?.text, 'Single-line Fit-then-flag (Auto-shrink to min bound)');
assert.strictEqual(selectItemCache.get('multi-line')?.text, 'Multi-line Auto-wrap (Wrap text within box)');

console.log('All Select component tests passed successfully!');
