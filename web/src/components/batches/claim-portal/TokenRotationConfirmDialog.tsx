/**
 * @file TokenRotationConfirmDialog.tsx
 * @description Radix Dialog warning that rotating tokens invalidates distributed tokens. Requires typing "ROTATE".
 * @architecture Security confirmation modal in ClaimPortalWorkspace preventing accidental credential invalidation.
 * @agent_note Requires user to type the word "ROTATE" before activating the confirmation action button.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Spinner";
import { Warning } from "@phosphor-icons/react";

export interface TokenRotationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  isRotating?: boolean;
}

/**
 * @component TokenRotationConfirmDialog
 * @description Destructive confirmation dialog requiring explicit string confirmation before rotating claim portal tokens.
 * @param {TokenRotationConfirmDialogProps} props - Component properties.
 * @param {boolean} props.open - Whether dialog modal is open.
 * @param {(open: boolean) => void} props.onOpenChange - Open state change handler.
 * @param {() => Promise<void>} props.onConfirm - Async token rotation confirmation handler.
 * @param {boolean} [props.isRotating=false] - Whether rotation request is in progress.
 * @state {string} confirmText - Text entered in confirmation input field (must equal "ROTATE").
 * @returns {JSX.Element} Radix Dialog with text verification input and confirm action.
 */
export function TokenRotationConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isRotating = false,
}: TokenRotationConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const handleConfirm = async () => {
    if (confirmText !== "ROTATE") return;
    await onConfirm();
    setConfirmText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 mb-2">
            <Warning className="w-5 h-5" weight="fill" />
          </div>
          <DialogTitle>Rotate Claim Portal Credentials?</DialogTitle>
          <DialogDescription>
            Rotating credentials invalidates all previously generated tokens and
            terminates active participant sessions immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs text-slate-600 dark:text-slate-400">
          <p>
            Any participant attempting to claim certificates with older tokens
            will be rejected. You must re-export the new CSV and distribute
            fresh tokens to all recipients.
          </p>
          <div className="space-y-1.5 pt-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Type <span className="text-rose-600 font-mono">ROTATE</span> to
              confirm:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="ROTATE"
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRotating}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={confirmText !== "ROTATE" || isRotating}
            className="gap-2"
          >
            {isRotating && <Spinner size="sm" />}
            <span>Rotate &amp; Revoke Prior Tokens</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
