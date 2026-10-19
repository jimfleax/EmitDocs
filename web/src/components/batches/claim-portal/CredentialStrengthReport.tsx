/**
 * @file CredentialStrengthReport.tsx
 * @description Visual audit report for imported credential strength, collision warnings, and entropy gates.
 * @architecture Security audit widget rendered in ClaimPortalWorkspace credentials tab for imported credential mode.
 * @agent_note Displays collision alerts, weak entropy warnings, and enforces secondary verification column requirements.
 */

import { CheckCircle } from "@phosphor-icons/react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

export interface CredentialStrengthReportProps {
  strength: {
    strong: boolean;
    reason?: string;
    collisions: string[];
  } | null;
  hasSecondaryField?: boolean;
}

/**
 * @component CredentialStrengthReport
 * @description Security audit report checking imported column uniqueness, collision counts, and minimum entropy requirements.
 * @param {CredentialStrengthReportProps} props - Component properties.
 * @param {Object | null} props.strength - Security evaluation report from server or client analysis.
 * @param {boolean} props.strength.strong - Whether credentials satisfy brute-force protection standards.
 * @param {string} [props.strength.reason] - Explanation of weakness if criteria are unmet.
 * @param {string[]} props.strength.collisions - List of duplicate credential values detected.
 * @param {boolean} [props.hasSecondaryField=false] - Whether a secondary verification factor is configured.
 * @returns {JSX.Element} Alert or success badge summarizing credential security strength.
 */
export function CredentialStrengthReport({
  strength,
  hasSecondaryField = false,
}: CredentialStrengthReportProps) {
  if (!strength) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
        Configure credential mapping above to evaluate security strength.
      </div>
    );
  }

  const hasCollisions = strength.collisions && strength.collisions.length > 0;

  if (hasCollisions) {
    return (
      <Alert variant="error" title="Duplicate Credential Collisions Detected">
        <p className="text-xs">
          Found {strength.collisions.length} duplicate credential value(s).
          Every participant must have a distinct identifier. Resolve duplicates
          in your batch list or add a secondary verification column to
          distinguish records.
        </p>
      </Alert>
    );
  }

  if (!strength.strong) {
    return (
      <Alert variant="warning" title="Weak Credential Security Gate">
        <div className="space-y-1.5 text-xs">
          <p>
            {strength.reason ||
              "Primary identifier length is under 12 characters or consists of predictable sequences."}
          </p>
          {!hasSecondaryField && (
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Action Required: Select a secondary verification column (e.g.
              Birthdate or Phone) to unlock portal activation.
            </p>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <CheckCircle
          className="w-4 h-4 text-emerald-600 shrink-0"
          weight="fill"
        />
        <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
          Credential schema verified: High-entropy identifier with zero
          duplicate collisions.
        </span>
      </div>
      <Badge variant="success" size="sm" shape="pill">
        Passed Preflight
      </Badge>
    </div>
  );
}
