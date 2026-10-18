/**
 * @file ClaimPortalSettingsPanel.tsx
 * @description Editable form for claim portal settings (label, instructions, public slug, and retention details).
 * @architecture Settings tab view in ClaimPortalWorkspace for managing user-facing labels, guidelines, and public link access.
 * @agent_note Provides dirty-state detection, input reset, and patch updates to /api/claim-portals/:portalId.
 */

import { useState, useEffect } from "react";
import { Copy, Check, ArrowSquareOut, Clock, FloppyDisk, ArrowCounterClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/Spinner";
import { Alert } from "@/components/ui/Alert";
import { toast } from "@/components/ui/toast";

export interface ClaimPortalSettingsPanelProps {
  portal: {
    _id: string;
    publicSlug: string;
    label: string;
    instructions?: string;
    expiresAt: string | Date;
    version: number;
    status: string;
  };
  onUpdatePortal: (updatedPortal: any) => void;
}

/**
 * @component ClaimPortalSettingsPanel
 * @description Form panel allowing organizers to customize portal title, public claim instructions, and copy shareable URLs.
 * @param {ClaimPortalSettingsPanelProps} props - Component properties.
 * @param {Object} props.portal - Claim portal entity data.
 * @param {string} props.portal._id - Portal unique ID.
 * @param {string} props.portal.publicSlug - URL slug for public recipient access.
 * @param {string} props.portal.label - Human-readable portal title.
 * @param {string} [props.portal.instructions] - Instructions displayed on the public claim screen.
 * @param {string | Date} props.portal.expiresAt - Expiration timestamp of the claim portal.
 * @param {number} props.portal.version - Optimistic concurrency version number.
 * @param {string} props.portal.status - Current portal lifecycle status.
 * @param {(updatedPortal: any) => void} props.onUpdatePortal - Callback invoked when settings update succeeds.
 * @state {string} label - Current text in title input field.
 * @state {string} instructions - Current text in instructions textarea.
 * @state {boolean} isSaving - Network in-flight state during patch request.
 * @state {string | null} error - Error message string if save fails.
 * @state {boolean} copied - Clipboard copy confirmation feedback flag.
 * @api {PATCH} /api/claim-portals/:portalId - Saves updated label and instructions.
 * @returns {JSX.Element} Settings form cards with live public link preview.
 */
export function ClaimPortalSettingsPanel({
  portal,
  onUpdatePortal,
}: ClaimPortalSettingsPanelProps) {
  const [label, setLabel] = useState(portal.label || "");
  const [instructions, setInstructions] = useState(portal.instructions || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLabel(portal.label || "");
    setInstructions(portal.instructions || "");
    setError(null);
  }, [portal.label, portal.instructions]);

  const isDirty =
    label.trim() !== (portal.label || "").trim() ||
    instructions.trim() !== (portal.instructions || "").trim();

  const handleReset = () => {
    setLabel(portal.label || "");
    setInstructions(portal.instructions || "");
    setError(null);
  };

  const fullPublicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/claim/${portal.publicSlug}`
      : `/claim/${portal.publicSlug}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullPublicUrl);
      setCopied(true);
      toast.success("Link Copied", "Public claim portal URL copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy Failed", "Failed to copy URL to clipboard.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) {
      setError("Portal title is required.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const res = await fetch(`/api/claim-portals/${portal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          label: label.trim(),
          instructions: instructions.trim(),
          expectedVersion: portal.version,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to update portal settings");
      }

      const data = await res.json();
      toast.success("Settings Saved", "Claim portal metadata and instructions have been updated.");
      if (data.portal) {
        onUpdatePortal(data.portal);
      }
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
      toast.error("Save Failed", err.message || "Failed to update portal settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-6"
    >
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Portal Metadata &amp; Customization
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure the public event title, participant claiming instructions, and view portal distribution details.
        </p>
      </div>

      {error && (
        <Alert variant="error" title="Failed to Save Settings">
          <p className="text-xs">{error}</p>
        </Alert>
      )}

      {/* Portal Title / Safe Label */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="portal-label" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Portal Title / Safe Event Name <span className="text-rose-500">*</span>
          </label>
          <span className="text-[10px] text-slate-400">Required</span>
        </div>
        <Input
          id="portal-label"
          type="text"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g., Annual Tech Symposium 2026 Certificates"
          required
          className="h-10 text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
        />
        <p className="text-[11px] text-slate-400">
          Displayed on the public claim page header, document confirmation card, and browser tab.
        </p>
      </div>

      {/* Participant Instructions */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="portal-instructions" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Participant Instructions (Optional)
          </label>
          <span className="text-[10px] font-mono text-slate-400">
            {instructions.length} / 2000
          </span>
        </div>
        <textarea
          id="portal-instructions"
          rows={4}
          maxLength={2000}
          value={instructions}
          onChange={(e) => {
            setInstructions(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g., Enter your participant token or registered student ID. If you have questions about your certificate, contact support@event.org."
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs shadow-xs transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
        />
        <p className="text-[11px] text-slate-400">
          Custom instructions shown to recipients on the claim portal page before claiming.
        </p>
      </div>

      {/* Public Claim URL */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Public Claim URL
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 select-all overflow-x-auto whitespace-nowrap">
            {fullPublicUrl}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="text-xs gap-1.5 shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </Button>
          <a
            href={fullPublicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
          >
            <span>Open</span>
            <ArrowSquareOut className="w-3.5 h-3.5 text-slate-400" />
          </a>
        </div>
        <p className="text-[11px] text-slate-400">
          Public routing link for participants. Credentials and Turnstile bot protection are verified on submission.
        </p>
      </div>

      {/* Retention Expiry Card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950 flex items-start gap-3">
        <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs">
          <div className="font-semibold text-slate-800 dark:text-slate-200">
            Retention Expiry: {portal.expiresAt ? new Date(portal.expiresAt).toLocaleString() : "—"}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Bound to batch retention policy. The claim portal automatically closes and credential verifiers are purged when retention expires.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
        <div>
          {isDirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              You have unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              className="text-xs gap-1.5 cursor-pointer text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <ArrowCounterClockwise className="w-3.5 h-3.5" />
              <span>Discard</span>
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isSaving || !label.trim() || !isDirty}
            className="text-xs font-semibold gap-1.5 cursor-pointer"
          >
            {isSaving ? (
              <>
                <Spinner size="sm" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FloppyDisk className="w-3.5 h-3.5" />
                <span>Save Settings</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
