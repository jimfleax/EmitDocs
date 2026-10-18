/**
 * @file PublicClaimCredentialForm.tsx
 * @description Participant claim form supporting single token or dual primary+secondary credential inputs with Turnstile integration.
 */

import { useState } from "react";
import { Key, ArrowRight, ShieldCheck } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";
import { TurnstileChallenge } from "./TurnstileChallenge";

export interface PublicClaimCredentialFormProps {
  credentialMode: "generated_token" | "imported_credential";
  primaryFieldLabel?: string;
  secondaryFieldLabel?: string;
  requiresTurnstile?: boolean;
  turnstileSiteKey?: string;
  onSubmit: (creds: {
    primaryCredential: string;
    secondaryCredential?: string;
    turnstileToken?: string;
  }) => Promise<void>;
  isLoading?: boolean;
}

export function PublicClaimCredentialForm({
  credentialMode,
  primaryFieldLabel,
  secondaryFieldLabel,
  requiresTurnstile = false,
  turnstileSiteKey,
  onSubmit,
  isLoading = false,
}: PublicClaimCredentialFormProps) {
  const [primary, setPrimary] = useState("");
  const [secondary, setSecondary] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primary.trim() || isLoading) return;
    await onSubmit({
      primaryCredential: primary.trim(),
      secondaryCredential: secondary ? secondary.trim() : undefined,
      turnstileToken,
    });
  };

  const isTokenMode = credentialMode === "generated_token";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isTokenMode ? (
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Claim Access Token
          </label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <Input
              type="text"
              required
              autoFocus
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder="e.g. 43-character token"
              className="pl-9 font-mono text-xs h-10 tracking-wider bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              disabled={isLoading}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Enter the private claim token provided by your organizer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {primaryFieldLabel || "Primary Identifier"}
            </label>
            <Input
              type="text"
              required
              autoFocus
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              placeholder={`Enter your ${primaryFieldLabel || "ID"}...`}
              className="text-xs h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
              disabled={isLoading}
            />
          </div>

          {secondaryFieldLabel && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {secondaryFieldLabel}
              </label>
              <Input
                type="text"
                required
                value={secondary}
                onChange={(e) => setSecondary(e.target.value)}
                placeholder={`Enter your ${secondaryFieldLabel}...`}
                className="text-xs h-10 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      )}

      {requiresTurnstile && (
        <div className="pt-2 flex justify-center">
          <TurnstileChallenge
            siteKey={turnstileSiteKey}
            onSuccess={setTurnstileToken}
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={!primary.trim() || (requiresTurnstile && !turnstileToken) || isLoading}
        className="w-full h-11 text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 rounded-xl transition-all cursor-pointer"
      >
        {isLoading ? <Spinner size="sm" /> : <ShieldCheck className="w-4 h-4" />}
        <span>Verify &amp; Access Certificate</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </form>
  );
}
