import { Alert } from '@/components/ui/Alert';

interface DuplicateWarningProps {
  duplicateCount: number;
}

export function DuplicateWarning({ duplicateCount }: DuplicateWarningProps) {
  if (duplicateCount <= 0) return null;

  return (
    <Alert
      variant="warning"
      title={`${duplicateCount} Duplicate ${duplicateCount === 1 ? 'Record' : 'Records'} Detected`}
    >
      In accordance with issuance policy (AC4), identical rows are <strong>preserved</strong> and
      flagged with warnings rather than silently deleted or merged. Each duplicate will generate an
      independent document unless manually excluded during draft review.
    </Alert>
  );
}
