/**
 * @file web-claim-portal-fixes.test.ts
 * @description Unit tests validating review comment fixes across web claim portal components.
 * @architecture Web component and utility unit test suite verifying CSV cell escaping, CredentialModeSelector accessibility, lifecycle button controls, and GenericClaimFailure message display.
 * @agent_note Run via `npx tsx test/web-claim-portal-fixes.test.ts`. Uses react-dom/server to inspect component render outputs without browser DOM.
 */

import assert from "node:assert";
import React from "react";
(globalThis as any).React = React;
import { renderToStaticMarkup } from "react-dom/server";
import { escapeCsvCell } from "../web/src/lib/csv-escape";
import { CredentialModeSelector } from "../web/src/components/batches/claim-portal/CredentialModeSelector";
import { ClaimPortalLifecycleControls } from "../web/src/components/batches/claim-portal/ClaimPortalLifecycleControls";
import { GenericClaimFailure } from "../web/src/components/claim/GenericClaimFailure";

console.log("Running Web Claim Portal Review Fixes Tests...\n");

// -----------------------------------------------------------------------------
// 1. CSV Escaping & Spreadsheet Formula Injection Protection
// -----------------------------------------------------------------------------
console.log("1. Testing escapeCsvCell helper...");

// Basic escaping & quotes doubling
assert.strictEqual(escapeCsvCell("John Doe"), '"John Doe"');
assert.strictEqual(escapeCsvCell('John "The Boss" Doe'), '"John ""The Boss"" Doe"');
assert.strictEqual(escapeCsvCell(null), '""');
assert.strictEqual(escapeCsvCell(undefined), '""');

// Spreadsheet formula protection on non-token fields (=, +, -, @, \t, \r)
assert.strictEqual(escapeCsvCell("=SUM(A1:A10)"), "\"'=SUM(A1:A10)\"");
assert.strictEqual(escapeCsvCell("+1234567890"), "\"'+1234567890\"");
assert.strictEqual(escapeCsvCell("-100"), "\"'-100\"");
assert.strictEqual(escapeCsvCell("@executive"), "\"'@executive\"");
assert.strictEqual(escapeCsvCell("\tcmd"), "\"'\tcmd\"");

// Preservation of raw tokens (no leading apostrophe added even if starting with formula chars)
assert.strictEqual(escapeCsvCell("-token-12345", true), '"-token-12345"');
assert.strictEqual(escapeCsvCell("+token-xyz", true), '"+token-xyz"');
assert.strictEqual(escapeCsvCell("=tok", true), '"=tok"');
assert.strictEqual(escapeCsvCell('@secret"token', true), '"@secret""token"'); // quotes doubled, but no leading apostrophe

console.log("   ✓ CSV escaping correctly doubles quotes, sanitizes formula prefixes on non-tokens, and preserves raw tokens\n");

// -----------------------------------------------------------------------------
// 2. CredentialModeSelector Keyboard Accessibility
// -----------------------------------------------------------------------------
console.log("2. Testing CredentialModeSelector accessibility...");

const selectorHtml = renderToStaticMarkup(
  React.createElement(CredentialModeSelector, {
    mode: "generated_token",
    onChange: () => {},
  })
);

assert.ok(selectorHtml.includes('role="radiogroup"'), "Container should have role='radiogroup'");
assert.ok(selectorHtml.includes('<button type="button" role="radio" aria-checked="true"'), "Selected mode should be a button with role='radio' and aria-checked='true'");
assert.ok(selectorHtml.includes('<button type="button" role="radio" aria-checked="false"'), "Unselected mode should be a button with role='radio' and aria-checked='false'");

// Disabled state
const disabledSelectorHtml = renderToStaticMarkup(
  React.createElement(CredentialModeSelector, {
    mode: "imported_credential",
    onChange: () => {},
    disabled: true,
  })
);
assert.ok(disabledSelectorHtml.includes('disabled=""') || disabledSelectorHtml.includes('disabled'), "Buttons should have native disabled attribute when disabled=true");

console.log("   ✓ CredentialModeSelector uses accessible buttons with radio semantics and handles disabled state\n");

// -----------------------------------------------------------------------------
// 3. ClaimPortalLifecycleControls Resume button condition
// -----------------------------------------------------------------------------
console.log("3. Testing ClaimPortalLifecycleControls Resume button...");

const noop = async () => {};

// When status is "paused", Resume Portal should be rendered
const pausedHtml = renderToStaticMarkup(
  React.createElement(ClaimPortalLifecycleControls, {
    status: "paused",
    isReady: true,
    hasBlockers: false,
    onActivate: noop,
    onPause: noop,
    onResume: noop,
    onDisable: noop,
    onClose: noop,
  })
);
assert.ok(pausedHtml.includes("Resume Portal"), "Resume Portal button must be rendered when status is 'paused'");

// When status is "disabled", Resume Portal must NOT be rendered
const disabledHtml = renderToStaticMarkup(
  React.createElement(ClaimPortalLifecycleControls, {
    status: "disabled",
    isReady: true,
    hasBlockers: false,
    onActivate: noop,
    onPause: noop,
    onResume: noop,
    onDisable: noop,
    onClose: noop,
  })
);
assert.ok(!disabledHtml.includes("Resume Portal"), "Resume Portal button must NOT be rendered when status is 'disabled'");

console.log("   ✓ Resume Portal button only renders for paused portals, not disabled portals\n");

// -----------------------------------------------------------------------------
// 4. GenericClaimFailure Custom Message Support
// -----------------------------------------------------------------------------
console.log("4. Testing GenericClaimFailure custom message...");

const defaultFailureHtml = renderToStaticMarkup(
  React.createElement(GenericClaimFailure, {
    requestId: "req_123",
  })
);
assert.ok(defaultFailureHtml.includes("We couldn&#x27;t complete this claim") || defaultFailureHtml.includes("We couldn't complete this claim"), "Default message should render when no custom message provided");
assert.ok(defaultFailureHtml.includes("Ref: req_123"), "Request ID should render");

const customFailureHtml = renderToStaticMarkup(
  React.createElement(GenericClaimFailure, {
    requestId: "req_456",
    message: "Rate limit exceeded. Please wait 45 seconds before trying again.",
  })
);
assert.ok(customFailureHtml.includes("Rate limit exceeded. Please wait 45 seconds before trying again."), "Custom retry-after message should render in GenericClaimFailure");

console.log("   ✓ GenericClaimFailure supports custom messages while displaying request IDs\n");

console.log("🎉 ALL Web Claim Portal review fix tests PASSED!\n");
