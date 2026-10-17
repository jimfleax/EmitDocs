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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DriftCheckResult {
  hasDrift: boolean;
  message: string;
  diffSummary?: string[];
}

/**
 * Checks for contract drift between in-memory specification and committed openapi.json.
 *
 * @param {string} [specPath] - Path to committed OpenAPI JSON file.
 * @returns {DriftCheckResult}
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
