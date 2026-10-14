/**
 * @file DuplicateWarning.tsx
 * @description Policy advisory banner informing users about duplicate record retention rules during batch import.
 * @architecture Informational Alert component reinforcing deterministic issuance policy (AC4) during data review.
 * @agent_note Explains that duplicates are preserved with warning tags rather than dropped, unless manually dismissed.
 */

import { Alert } from "@/components/ui/Alert";

interface DuplicateWarningProps {
  duplicateCount: number;
}

/**
 * @component DuplicateWarning
 * @description Renders a warning alert notifying users of duplicate records preserved under issuance policy.
 * @param {DuplicateWarningProps} props - Component properties.
 * @param {number} props.duplicateCount - Number of duplicate records detected.
 * @returns {JSX.Element | null} Rendered Alert or null if count is 0.
 */
export function DuplicateWarning({ duplicateCount }: DuplicateWarningProps) {
  if (duplicateCount <= 0) return null;

  return (
    <Alert
      variant="warning"
      title={`${duplicateCount} Duplicate ${duplicateCount === 1 ? "Record" : "Records"} Detected`}
    >
      In accordance with issuance policy (AC4), identical rows are{" "}
      <strong>preserved</strong> and flagged with warnings rather than silently
      deleted or merged. Each duplicate will generate an independent document
      unless manually excluded during draft review.
    </Alert>
  );
}
