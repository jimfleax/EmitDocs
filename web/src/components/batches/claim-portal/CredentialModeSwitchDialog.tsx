/**
 * @file CredentialModeSwitchDialog.tsx
 * @description Dialog warning that switching credential mode revokes prior credentials and pauses portal.
 * @architecture Confirmation modal rendered in ClaimPortalWorkspace before changing authentication modes on an active portal.
 * @agent_note Warns that mode switching increments credential revision, invalidates previous secrets, and pauses the portal.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { Warning } from "@phosphor-icons/react";
import type { ClaimCredentialMode } from "./CredentialModeSelector";

export interface CredentialModeSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetMode: ClaimCredentialMode;
  onConfirm: () => Promise<void>;
  isSwitching?: boolean;
}

/**
 * @component CredentialModeSwitchDialog
 * @description Warning modal prompting confirmation before switching credential modes, explaining token invalidation and portal pausing.
 * @param {CredentialModeSwitchDialogProps} props - Component properties.
 * @param {boolean} props.open - Whether dialog is visible.
 * @param {(open: boolean) => void} props.onOpenChange - Open state callback.
 * @param {ClaimCredentialMode} props.targetMode - Intended new credential mode.
 * @param {() => Promise<void>} props.onConfirm - Async confirmation execution handler.
 * @param {boolean} [props.isSwitching=false] - Whether mutation is currently in flight.
 * @returns {JSX.Element} Radix Dialog with destructive warning message and action buttons.
 */
export function CredentialModeSwitchDialog({
  open,
  onOpenChange,
  targetMode,
  onConfirm,
  isSwitching = false,
}: CredentialModeSwitchDialogProps) {
  const modeLabel =
    targetMode === "generated_token"
      ? "Generated Tokens (CSPRNG)"
      : "Imported Credentials (Column Mapping)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 mb-2">
            <Warning className="w-5 h-5" weight="fill" />
          </div>
          <DialogTitle>Switch Authentication Mode to {modeLabel}?</DialogTitle>
          <DialogDescription>
            Switching mode increments the portal credential revision and
            temporarily pauses public claims.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          <p>
            1. All previously configured credential verifiers and active
            participant sessions will be immediately invalidated.
          </p>
          <p>
            2. The portal will transition to <strong>Paused</strong> status
            until the new credential configuration is locked and tested.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSwitching}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={isSwitching}
            className="gap-2"
          >
            {isSwitching && <Spinner size="sm" />}
            <span>Confirm Mode Switch</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
