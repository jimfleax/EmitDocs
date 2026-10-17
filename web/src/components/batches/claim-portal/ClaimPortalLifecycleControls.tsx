/**
 * @file ClaimPortalLifecycleControls.tsx
 * @description Action buttons for Activate, Pause, Resume, Disable, and Close lifecycle operations.
 */

import { useState } from "react";
import { Play, Pause, Stop, Lock, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { ClaimPortalStatus } from "./ClaimPortalStatusHeader";

export interface ClaimPortalLifecycleControlsProps {
  status: ClaimPortalStatus;
  isReady: boolean;
  hasBlockers: boolean;
  onActivate: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onDisable: () => Promise<void>;
  onClose: () => Promise<void>;
  isLoading?: boolean;
}

export function ClaimPortalLifecycleControls({
  status,
  isReady,
  hasBlockers,
  onActivate,
  onPause,
  onResume,
  onDisable,
  onClose,
  isLoading = false,
}: ClaimPortalLifecycleControlsProps) {
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const runAction = async (name: string, fn: () => Promise<void>) => {
    try {
      setActionInProgress(name);
      await fn();
    } finally {
      setActionInProgress(null);
    }
  };

  const isClosed = status === "closed";
  const isExpired = status === "expired";

  if (isClosed || isExpired) {
    return (
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
        <Lock className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          This claim portal is {status}. Public claim access is permanently terminated.
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs">
          <span className="font-bold text-slate-900 dark:text-slate-100 block">
            Portal Lifecycle State
          </span>
          <span className="text-slate-500 dark:text-slate-400 block">
            Current status: <strong className="uppercase font-mono">{status}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Activate Portal (from draft or ready) */}
          {(status === "draft" || status === "ready") && (
            <Button
              onClick={() => runAction("activate", onActivate)}
              disabled={!isReady || hasBlockers || isLoading || !!actionInProgress}
              className="text-xs font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {actionInProgress === "activate" ? <Spinner size="sm" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Activate Portal</span>
            </Button>
          )}

          {/* Pause Portal */}
          {status === "active" && (
            <Button
              variant="outline"
              onClick={() => runAction("pause", onPause)}
              disabled={isLoading || !!actionInProgress}
              className="text-xs font-bold gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50"
            >
              {actionInProgress === "pause" ? <Spinner size="sm" /> : <Pause className="w-4 h-4" weight="fill" />}
              <span>Pause Claims</span>
            </Button>
          )}

          {/* Resume Portal */}
          {(status === "paused" || status === "disabled") && (
            <Button
              onClick={() => runAction("resume", onResume)}
              disabled={isLoading || !!actionInProgress}
              className="text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionInProgress === "resume" ? <Spinner size="sm" /> : <Play className="w-4 h-4" weight="fill" />}
              <span>Resume Portal</span>
            </Button>
          )}

          {/* Disable Portal */}
          {status === "active" && (
            <Button
              variant="outline"
              onClick={() => runAction("disable", onDisable)}
              disabled={isLoading || !!actionInProgress}
              className="text-xs gap-1.5 text-slate-600"
            >
              <span>Disable</span>
            </Button>
          )}

          {/* Close Portal (Permanent) */}
          {status !== "draft" && (
            <Button
              variant="destructive"
              onClick={() => setCloseConfirmOpen(true)}
              disabled={isLoading || !!actionInProgress}
              className="text-xs gap-1.5"
            >
              <Stop className="w-3.5 h-3.5" weight="fill" />
              <span>Close Portal</span>
            </Button>
          )}
        </div>
      </div>

      {/* Close Portal Modal */}
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Permanently Close Claim Portal?</DialogTitle>
            <DialogDescription>
              Closing the portal is irreversible. All credential verifiers will be marked revoked, active sessions killed, and no further claims accepted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCloseConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setCloseConfirmOpen(false);
                await runAction("close", onClose);
              }}
            >
              Close Portal Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
