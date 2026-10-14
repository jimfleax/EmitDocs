/**
 * @file toast-lifecycle.test.ts
 * @description TDD unit tests for toast notification state lifecycle, test seams, and event subscriptions.
 * @agent_note Run via `pnpm run test:toast`. Tests execute in Node via tsx.
 */

import assert from "node:assert";
import {
  toast,
  clearToasts,
  subscribeToasts,
  getActiveToasts,
  dismissToast,
} from "../web/src/components/ui/toast";

console.log("Running Toast lifecycle TDD tests...");

// Reset before tests
clearToasts();
assert.strictEqual(getActiveToasts().length, 0, "Initial active toasts should be empty");

// Test 1: Basic toast dispatch with unique ID and default variant
const id1 = toast("Basic notification");
assert.ok(id1.startsWith("toast-"), "Toast ID should have 'toast-' prefix");
let active = getActiveToasts();
assert.strictEqual(active.length, 1, "Should have 1 active toast");
assert.strictEqual(active[0].id, id1);
assert.strictEqual(active[0].title, "Basic notification");
assert.strictEqual(active[0].variant, "default");

// Test 2: Variants (success, error, warning, info)
const sId = toast.success("Saved successfully", "Changes persisted");
const eId = toast.error("Error occurred", "Network timeout");
const wId = toast.warning("Warning", "Storage low");
const iId = toast.info("Information", "New version available");

active = getActiveToasts();
assert.strictEqual(active.length, 5, "Should have 5 active toasts");

const successToast = active.find((t) => t.id === sId);
assert.ok(successToast, "Success toast should be present");
assert.strictEqual(successToast.variant, "success");
assert.strictEqual(successToast.title, "Saved successfully");
assert.strictEqual(successToast.description, "Changes persisted");

const errorToast = active.find((t) => t.id === eId);
assert.ok(errorToast, "Error toast should be present");
assert.strictEqual(errorToast.variant, "error");

const warnToast = active.find((t) => t.id === wId);
assert.ok(warnToast, "Warning toast should be present");
assert.strictEqual(warnToast.variant, "warning");

const infoToast = active.find((t) => t.id === iId);
assert.ok(infoToast, "Info toast should be present");
assert.strictEqual(infoToast.variant, "info");

// Test 3: toast.loading variant, duration=0, dismissible=false
const lId = toast.loading("Uploading files...", "Please wait");
active = getActiveToasts();
const loadingToast = active.find((t) => t.id === lId);
assert.ok(loadingToast, "Loading toast should be present");
assert.strictEqual(loadingToast.variant, "loading");
assert.strictEqual(loadingToast.duration, 0);
assert.strictEqual(loadingToast.dismissible, false);

// Test 4: dismissToast removes targeted toast and preserves others
dismissToast(sId);
active = getActiveToasts();
assert.strictEqual(active.find((t) => t.id === sId), undefined, "Dismissed toast should be removed");
assert.ok(active.find((t) => t.id === lId), "Other toasts should be preserved");

// Test 5: Async progress replacement lifecycle (loading -> dismiss -> success/error)
clearToasts();
assert.strictEqual(getActiveToasts().length, 0);

const progressId = toast.loading("Processing dataset...");
assert.strictEqual(getActiveToasts().length, 1);
assert.strictEqual(getActiveToasts()[0].variant, "loading");

// Replace loading with success
toast.dismiss(progressId);
const doneId = toast.success("Processing complete", "100 rows validated");
active = getActiveToasts();
assert.strictEqual(active.length, 1);
assert.strictEqual(active[0].id, doneId);
assert.strictEqual(active[0].variant, "success");

// Test 6: Subscription listener and unsubscribe
let subscriberCallCount = 0;
let lastSeenToasts: any[] = [];
const unsubscribe = subscribeToasts((toasts) => {
  subscriberCallCount++;
  lastSeenToasts = toasts;
});

const subToastId = toast.info("Subscribed notification");
assert.ok(subscriberCallCount >= 1, "Subscriber should have been called on toast add");
assert.ok(lastSeenToasts.some((t) => t.id === subToastId), "Subscriber should receive the new toast");

unsubscribe();
const countBefore = subscriberCallCount;
toast.warning("After unsubscribe");
assert.strictEqual(subscriberCallCount, countBefore, "Subscriber should NOT be called after unsubscribe");

// Test 7: clearToasts resets the active list
clearToasts();
assert.strictEqual(getActiveToasts().length, 0, "clearToasts should leave 0 active toasts");

console.log("All Toast lifecycle tests passed successfully!");
