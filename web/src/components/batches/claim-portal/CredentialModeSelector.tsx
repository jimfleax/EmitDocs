/**
 * @file CredentialModeSelector.tsx
 * @description Radio card selection between generated CSPRNG tokens and mapped imported credentials.
 */

import { Key, Table, ShieldCheck, Warning } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

export type ClaimCredentialMode = "generated_token" | "imported_credential";

export interface CredentialModeSelectorProps {
  mode: ClaimCredentialMode;
  onChange: (mode: ClaimCredentialMode) => void;
  disabled?: boolean;
  isExistingPortal?: boolean;
}

export function CredentialModeSelector({
  mode,
  onChange,
  disabled = false,
  isExistingPortal = false,
}: CredentialModeSelectorProps) {
  return (
    <div className="space-y-3">
      {isExistingPortal && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-300">
          <Warning className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            Switching mode increments credential revision, pauses the portal, and revokes previously distributed secrets.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="radiogroup" aria-label="Credential Mode">
        {/* Generated Token Option */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === "generated_token"}
          disabled={disabled}
          onClick={() => !disabled && onChange("generated_token")}
          className={cn(
            "text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 w-full",
            mode === "generated_token"
              ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Key className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Generated Tokens
                </h4>
              </div>
              <Badge variant="primary" size="sm" shape="pill">
                Recommended
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              EmitDocs produces 256-bit CSPRNG random tokens. Export once as CSV to merge into your bulk mailer or distribution system.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>High-entropy, zero plaintext storage in database</span>
          </div>
        </button>

        {/* Imported Credential Option */}
        <button
          type="button"
          role="radio"
          aria-checked={mode === "imported_credential"}
          disabled={disabled}
          onClick={() => !disabled && onChange("imported_credential")}
          className={cn(
            "text-left p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 w-full",
            mode === "imported_credential"
              ? "border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs"
              : "border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Table className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Imported Credentials
                </h4>
              </div>
              <Badge variant="neutral" size="sm" shape="pill">
                Custom Mapping
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Map participant identifiers from your approved batch list (e.g., Student ID or Employee Number) with optional secondary factor.
            </p>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Collision detection and mandatory 2FA on weak keys</span>
          </div>
        </button>
      </div>
    </div>
  );
}
