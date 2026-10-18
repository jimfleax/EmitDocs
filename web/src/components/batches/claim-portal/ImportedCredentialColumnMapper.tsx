/**
 * @file ImportedCredentialColumnMapper.tsx
 * @description Column mapper for primary identifier and optional secondary factor from approved batch schema.
 * @architecture Configuration dropdown card rendered in ClaimPortalWorkspace credentials tab for mapped credential mode.
 * @agent_note Allows selecting primary and secondary column keys from approved batch spreadsheet headers with validation alerts.
 */

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/Badge";
import { Info } from "@phosphor-icons/react";

export interface ImportedCredentialColumnMapperProps {
  availableColumns: string[];
  primaryFieldKey: string;
  secondaryFieldKey?: string;
  onPrimaryChange: (field: string) => void;
  onSecondaryChange: (field: string | undefined) => void;
  disabled?: boolean;
  requiresSecondary?: boolean;
}

/**
 * @component ImportedCredentialColumnMapper
 * @description Dropdown selector allowing organizers to designate primary and optional secondary credential columns for participant verification.
 * @param {ImportedCredentialColumnMapperProps} props - Component properties.
 * @param {string[]} props.availableColumns - List of column headers available in the batch dataset.
 * @param {string} props.primaryFieldKey - Selected primary identifier column key.
 * @param {string} [props.secondaryFieldKey] - Selected secondary verification column key.
 * @param {(field: string) => void} props.onPrimaryChange - Callback when primary column selection changes.
 * @param {(field: string | undefined) => void} props.onSecondaryChange - Callback when secondary column selection changes.
 * @param {boolean} [props.disabled=false] - Whether dropdowns are disabled.
 * @param {boolean} [props.requiresSecondary=false] - Whether secondary factor is enforced due to weak primary entropy.
 * @returns {JSX.Element} Form card with primary and secondary column dropdown selectors.
 */
export function ImportedCredentialColumnMapper({
  availableColumns,
  primaryFieldKey,
  secondaryFieldKey,
  onPrimaryChange,
  onSecondaryChange,
  disabled = false,
  requiresSecondary = false,
}: ImportedCredentialColumnMapperProps) {
  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
      <div className="flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Select columns from your imported batch data. Credentials are case-sensitive and preserve leading zeroes.
          If the primary identifier is short or predictable, a secondary factor is required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Primary Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span>Primary Credential Column</span>
            <span className="text-rose-500">*</span>
          </label>
          <Select
            value={primaryFieldKey}
            onValueChange={onPrimaryChange}
          >
            <SelectTrigger disabled={disabled} className="h-9 text-xs">
              <SelectValue placeholder="Select primary field..." />
            </SelectTrigger>
            <SelectContent>
              {availableColumns.map((col) => (
                <SelectItem key={col} value={col}>
                  {col}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-slate-400 block">
            e.g., Student ID, Roll Number, or Registration Code
          </span>
        </div>

        {/* Secondary Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Secondary Verification Column
            </label>
            {requiresSecondary ? (
              <Badge variant="error" size="sm">
                Required
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Optional
              </Badge>
            )}
          </div>
          <Select
            value={secondaryFieldKey || "__none__"}
            onValueChange={(val) => onSecondaryChange(val === "__none__" ? undefined : val)}
          >
            <SelectTrigger disabled={disabled} className="h-9 text-xs">
              <SelectValue placeholder="Select secondary field (optional)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None (Single Factor)</SelectItem>
              {availableColumns
                .filter((col) => col !== primaryFieldKey)
                .map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-slate-400 block">
            e.g., Birthdate (YYYY-MM-DD) or Phone Number
          </span>
        </div>
      </div>
    </div>
  );
}
