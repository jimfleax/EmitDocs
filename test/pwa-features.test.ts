/**
 * @file pwa-features.test.ts
 * @description Verification test suite for PWA assets, webmanifest integrity, iOS meta tags, and Service Worker structure.
 * @architecture Static asset and client bundle verification test suite validating progressive web app manifest properties, icons, and worker registration files.
 * @agent_note Run via `npx tsx test/pwa-features.test.ts`. Filesystem integrity verification without requiring external services.
 */

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.join(ROOT_DIR, "web");

console.log("=== RUNNING PWA FEATURES VERIFICATION TESTS ===\n");

// 1. Verify site.webmanifest exists and has all required PWA fields
console.log("1. Testing site.webmanifest integrity...");
const manifestPath = path.join(WEB_DIR, "public", "pwa", "site.webmanifest");
assert.ok(fs.existsSync(manifestPath), "site.webmanifest file must exist");
const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

assert.strictEqual(manifestContent.display, "standalone", "Display mode must be standalone");
assert.strictEqual(manifestContent.start_url, "/app/", "Start URL must point to /app/");
assert.ok(manifestContent.name, "Manifest name must be defined");
assert.ok(manifestContent.short_name, "Manifest short_name must be defined");
assert.ok(Array.isArray(manifestContent.icons) && manifestContent.icons.length >= 2, "Must contain at least 2 icons");
assert.ok(Array.isArray(manifestContent.shortcuts) && manifestContent.shortcuts.length >= 2, "Must contain at least 2 shortcuts");
assert.ok(manifestContent.categories && manifestContent.categories.includes("productivity"), "Must include productivity category");

// Verify icon files referenced in manifest actually exist on disk
for (const icon of manifestContent.icons) {
  const iconDiskPath = path.join(WEB_DIR, "public", icon.src);
  assert.ok(fs.existsSync(iconDiskPath), `Icon file ${icon.src} must exist at ${iconDiskPath}`);
}
console.log("   ✓ site.webmanifest passed validation with valid icons and shortcuts");

// 2. Verify web/index.html includes manifest link and iOS meta tags
console.log("2. Testing index.html PWA tags...");
const indexPath = path.join(WEB_DIR, "index.html");
const indexHtml = fs.readFileSync(indexPath, "utf-8");

assert.ok(indexHtml.includes('rel="manifest" href="/pwa/site.webmanifest"'), "index.html must link to site.webmanifest");
assert.ok(indexHtml.includes('name="apple-mobile-web-app-capable" content="yes"'), "index.html must include apple-mobile-web-app-capable");
assert.ok(indexHtml.includes('name="apple-mobile-web-app-title" content="EmitDocs"'), "index.html must include apple-mobile-web-app-title");
assert.ok(indexHtml.includes('name="theme-color"'), "index.html must define theme-color");
console.log("   ✓ index.html contains all required PWA and iOS standalone tags");

// 3. Verify public/sw.js syntax, precache list, and routing logic
console.log("3. Testing sw.js structure and cache routing...");
const swPath = path.join(WEB_DIR, "public", "sw.js");
assert.ok(fs.existsSync(swPath), "sw.js must exist in public directory");
const swContent = fs.readFileSync(swPath, "utf-8");

assert.ok(swContent.includes("PRECACHE_URLS"), "sw.js must define precache URLs");
assert.ok(swContent.includes("skipWaiting"), "sw.js must support skipWaiting");
assert.ok(swContent.includes("SKIP_WAITING"), "sw.js must listen for SKIP_WAITING message");
assert.ok(swContent.includes("clients.claim"), "sw.js must claim clients on activate");
assert.ok(swContent.includes("mode === 'navigate'"), "sw.js must handle HTML navigation requests with fallback");
assert.ok(swContent.includes("/api/"), "sw.js must handle /api/ routing with offline fallback");
assert.ok(swContent.includes("cache.put('/index.html'"), "sw.js must refresh /index.html in cache on navigation");
assert.ok(swContent.includes("no-store") && swContent.includes("private"), "sw.js must skip caching /api/ responses with no-store or private");
assert.ok(!swContent.includes(".then(() => self.skipWaiting())"), "sw.js must not call skipWaiting automatically on install");
console.log("   ✓ sw.js has precaching, SPA navigation fallback, and API offline handling");

// 4. Verify PWA components exist and have proper exports
console.log("4. Testing React PWA components and hooks...");
const registerSwPath = path.join(WEB_DIR, "src", "lib", "registerSW.ts");
assert.ok(fs.existsSync(registerSwPath), "registerSW.ts must exist");
const registerSwContent = fs.readFileSync(registerSwPath, "utf-8");
assert.ok(registerSwContent.includes("getWaitingWorker"), "registerSW.ts must export getWaitingWorker");

const usePwaPath = path.join(WEB_DIR, "src", "hooks", "usePwa.ts");
assert.ok(fs.existsSync(usePwaPath), "usePwa.ts must exist");
const usePwaContent = fs.readFileSync(usePwaPath, "utf-8");
assert.ok(usePwaContent.includes("emitdocs_pwa_install_dismissed"), "usePwa must manage emitdocs_pwa_install_dismissed localStorage key");
assert.ok(usePwaContent.includes("promptInstall"), "usePwa must export promptInstall");
assert.ok(usePwaContent.includes("dismissInstall"), "usePwa must export dismissInstall");
assert.ok(usePwaContent.includes("globalDeferredPrompt"), "usePwa must capture prompt in module-level shared store");
assert.ok(usePwaContent.includes("getWaitingWorker"), "usePwa must read getWaitingWorker on mount");

const installCardPath = path.join(WEB_DIR, "src", "components", "pwa", "PwaInstallCard.tsx");
assert.ok(fs.existsSync(installCardPath), "PwaInstallCard.tsx must exist");
const installCardContent = fs.readFileSync(installCardPath, "utf-8");
assert.ok(installCardContent.includes("dismissInstall"), "PwaInstallCard must wire dismissInstall to dismiss button");
assert.ok(installCardContent.includes("INSTALL APP"), "PwaInstallCard must render INSTALL APP action");

const updateBannerPath = path.join(WEB_DIR, "src", "components", "pwa", "UpdateBanner.tsx");
assert.ok(fs.existsSync(updateBannerPath), "UpdateBanner.tsx must exist");

const offlineIndicatorPath = path.join(WEB_DIR, "src", "components", "pwa", "OfflineIndicator.tsx");
assert.ok(fs.existsSync(offlineIndicatorPath), "OfflineIndicator.tsx must exist");

// 5. Verify template version studio route note
const versionRoutePath = path.join(WEB_DIR, "src", "routes", "_protected", "app", "templates", "$templateId_.versions.$versionId.tsx");
assert.ok(fs.existsSync(versionRoutePath), "version studio route must exist");
const versionRouteContent = fs.readFileSync(versionRoutePath, "utf-8");
assert.ok(!versionRouteContent.includes("without default AppShell"), "route must not claim to omit AppShell");
assert.ok(versionRouteContent.includes("inside the parent AppShell"), "route must reflect rendering inside parent AppShell");

console.log("   ✓ React PWA components and hooks correctly structured and wired\n");

console.log("🎉 ALL PWA VERIFICATION TESTS PASSED SUCCESSFULLY!");
