/**
 * @file account.tsx
 * @description User account settings & Danger Zone for permanent account deletion (PRD-CORE-09).
 * @architecture Authenticated settings page mounted inside AppShell with PageShell layout.
 * @agent_note Displays user profile details, retention links, and triggers account deletion dialog.
 */

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldWarning,
  Trash,
  Database,
  ArrowRight,
} from "@phosphor-icons/react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { authClient } from "@/lib/auth-client";

/**
 * @constant Route
 * @description Route definition for account settings at "/app/settings/account".
 */
export const Route = createFileRoute("/_protected/app/settings/account")({
  component: AccountSettingsPage,
});

/**
 * @component AccountSettingsPage
 * @description Settings page displaying user identity, retention policy entry point, and account deletion trigger.
 * @state Manages dialog open state for the Danger Zone account deletion modal.
 * @api Reads active user profile from authClient.useSession(); deletes account via DeleteAccountDialog.
 * @returns {JSX.Element} Account settings interface.
 */
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
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {userEmail}
              </p>
            </div>
          </div>
        </div>

        {/* Data Retention & Lifecycle Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
                <Database size={18} weight="bold" />
                <span>Data Retention</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Retention & Data Lifecycle Preferences
              </h3>
              <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
                Configure default batch expiration windows, automated recipient
                PII pruning schedules, and zero-storage guarantees.
              </p>
            </div>

            <Link
              to="/app/settings/retention"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              <span>Manage Retention</span>
              <ArrowRight size={14} weight="bold" />
            </Link>
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
                Irrevocably deletes your user account, all certificate templates
                in Cloudinary, active batches, recipient records, and active
                sessions. This action cannot be reversed.
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
