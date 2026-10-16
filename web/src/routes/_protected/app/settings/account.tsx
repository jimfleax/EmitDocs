/**
 * @file account.tsx
 * @description User account settings & Danger Zone for permanent account deletion (PRD-CORE-09).
 */

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldWarning, Trash } from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/_protected/app/settings/account")({
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { data: session } = authClient.useSession();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email || "—";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <PageShell
      title="Account Settings"
      subtitle="Manage your profile information, authentication, and data retention preferences."
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="4xl"
    >
      <div className="space-y-8 pb-12">
        {/* Profile Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex items-center gap-4">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt={userName}
                className="w-14 h-14 rounded-2xl object-cover ring-1 ring-slate-200 shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                {userInitial}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900">{userName}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-2xl bg-rose-50/50 border border-rose-200 shadow-2xs space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldWarning size={18} weight="bold" />
                <span>Danger Zone</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Permanently Delete Account
              </h3>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                Irrevocably deletes your user account, all certificate templates in Cloudinary, active batches, recipient records, and active sessions. This action cannot be reversed.
              </p>
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              className="cursor-pointer gap-1.5 shrink-0"
            >
              <Trash size={16} weight="bold" />
              <span>Delete Account</span>
            </Button>
          </div>
        </div>
      </div>

      <DeleteAccountDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      />
    </PageShell>
  );
}
