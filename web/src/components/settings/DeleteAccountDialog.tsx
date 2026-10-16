/**
 * @file DeleteAccountDialog.tsx
 * @description Destructive confirmation modal for permanent account deletion and data purging (PRD-CORE-09).
 */

import { useState } from "react";
import { Trash, Warning, CircleNotch } from "@phosphor-icons/react";
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
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";

export interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: DeleteAccountDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = confirmationInput.trim() === "DELETE";

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmationInput("");
    setError(null);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);

      const res = await fetch("/api/account", {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || "Failed to delete account");
      }

      toast.success("Account Deleted", "Your account and all associated assets have been permanently deleted.");

      try {
        await authClient.signOut();
      } catch {
        // Fallback if session already revoked
      }

      window.location.href = "/sign-in";
    } catch (err: any) {
      setError(err.message || "Failed to delete account. Please try again.");
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Trash size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="text-rose-600 dark:text-rose-400">
                Delete Account
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-sans text-xs mt-0.5">
                Permanent deletion of account, batches, templates &amp; assets
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Alert variant="error" icon={<Warning size={20} weight="fill" className="text-rose-500 shrink-0" />}>
            <div className="text-xs space-y-1">
              <p className="font-semibold">This action cannot be undone.</p>
              <p>
                All your templates, certificate assets stored in Cloudinary, batches, recipient data, and sessions will be immediately and irrevocably purged.
              </p>
            </div>
          </Alert>

          {error && (
            <p className="text-xs text-rose-600 font-semibold">{error}</p>
          )}

          <div className="space-y-2">
            <label
              htmlFor="confirm-delete-input"
              className="text-xs font-semibold text-slate-700 dark:text-slate-300 block"
            >
              Please type <span className="font-mono font-bold text-rose-600">DELETE</span> to confirm:
            </label>
            <Input
              id="confirm-delete-input"
              type="text"
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder="DELETE"
              disabled={isDeleting}
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="cursor-pointer gap-2"
          >
            {isDeleting ? (
              <>
                <CircleNotch size={14} weight="bold" className="animate-spin" />
                <span>Deleting Account...</span>
              </>
            ) : (
              <>
                <Trash size={14} weight="bold" />
                <span>Permanently Delete</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
