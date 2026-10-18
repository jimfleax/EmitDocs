/**
 * @file check-contract-drift.ts
 * @description Verifies that committed api/openapi.json matches the generated specification.
 *              Fails CI with exit code 1 if drift is detected.
 * @architecture Validates API schema synchronization against in-memory route specifications.
 *               Ensures changes to API endpoints are intentionally committed to openapi.json.
 * @agent_note Run via `pnpm run contract:check` or `npx tsx api/src/scripts/check-contract-drift.ts`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiSpec } from './generate-openapi.js';
import { honoApp } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @interface DriftCheckResult
 * @description Structure returned by checkContractDrift detailing drift verification status and discrepancies.
 * @property {boolean} hasDrift - True if differences are detected between committed spec and live routes.
 * @property {string} message - Human-readable summary of the drift check outcome.
 * @property {string[]} [diffSummary] - Specific list of missing or extraneous endpoints/paths.
 */
export interface DriftCheckResult {
  hasDrift: boolean;
  message: string;
  diffSummary?: string[];
}

/**
 * @desc Checks for contract drift between in-memory specification and committed openapi.json.
 *
 * @param {string} [specPath] - Path to committed OpenAPI JSON file.
 * @returns {DriftCheckResult} Drift status, message, and array of identified differences.
 */
export function checkContractDrift(specPath?: string): DriftCheckResult {
  const filePath = specPath || path.resolve(__dirname, '../../openapi.json');

  if (!fs.existsSync(filePath)) {
    return {
      hasDrift: true,
      message: `OpenAPI specification file missing at: ${filePath}. Run 'pnpm run contract:generate' to create it.`,
    };
  }

  const inMemorySpec = buildOpenApiSpec();
  const committedRaw = fs.readFileSync(filePath, 'utf8');

  let committedSpec: any;
  try {
    committedSpec = JSON.parse(committedRaw);
  } catch (err: any) {
    return {
      hasDrift: true,
      message: `Failed to parse committed ${filePath}: ${err.message}`,
    };
  }

  const expectedStr = JSON.stringify(inMemorySpec, null, 2) + '\n';
  const committedFormatted = JSON.stringify(committedSpec, null, 2) + '\n';

  const diffSummary: string[] = [];

  // Compare registered Hono routes against generated OpenAPI spec path-and-method pairs
  const specRoutes = new Set<string>();
  for (const [p, ops] of Object.entries(inMemorySpec.paths || {})) {
    for (const m of Object.keys(ops as object)) {
      specRoutes.add(`${m.toUpperCase()} ${p}`);
    }
  }

  const honoRoutes = new Set<string>();
  for (const route of honoApp.routes) {
    // Ignore middleware and catch-all / wildcard routes
    if (route.method === 'ALL' || route.path.endsWith('*')) continue;
    // Ignore root welcome endpoint at base path
    if (route.path === '/api' || route.path === '/api/') continue;

    const normPath = route.path.replace(/^\/api/, '').replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    honoRoutes.add(`${route.method.toUpperCase()} ${normPath}`);
  }

  for (const route of honoRoutes) {
    if (!specRoutes.has(route)) {
      diffSummary.push(`Missing route in OpenAPI spec (registered in Hono router): ${route}`);
    }
  }

  for (const route of specRoutes) {
    if (!honoRoutes.has(route)) {
      diffSummary.push(`Unexpected route in OpenAPI spec (not registered in Hono router): ${route}`);
    }
  }

  // Check critical path coverage
  const expectedPaths = Object.keys(inMemorySpec.paths);
  const committedPaths = Object.keys(committedSpec.paths || {});

  for (const p of expectedPaths) {
    if (!committedPaths.includes(p)) {
      diffSummary.push(`Missing path in committed spec: ${p}`);
    }
  }

  for (const p of committedPaths) {
    if (!expectedPaths.includes(p)) {
      diffSummary.push(`Unexpected extra path in committed spec: ${p}`);
    }
  }

  if (expectedStr !== committedFormatted || diffSummary.length > 0) {
    return {
      hasDrift: true,
      message: `OpenAPI contract drift detected! Committed api/openapi.json does not match generated specification.`,
      diffSummary,
    };
  }

  return {
    hasDrift: false,
    message: 'OpenAPI specification is synchronized with API route definitions. Zero drift detected.',
  };
}

// CLI runner
if (process.argv[1] === __filename) {
  const result = checkContractDrift();
  if (result.hasDrift) {
    console.error(`\x1b[31m[Contract Check FAILED]\x1b[0m ${result.message}`);
    if (result.diffSummary && result.diffSummary.length > 0) {
      console.error('Differences:');
      for (const diff of result.diffSummary) {
        console.error(` - ${diff}`);
      }
    }
    console.error('\nRun `pnpm run contract:generate` to regenerate and commit api/openapi.json.\n');
    process.exit(1);
  } else {
    console.log(`\x1b[32m[Contract Check PASSED]\x1b[0m ${result.message}`);
    process.exit(0);
  }
}
