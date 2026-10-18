/**
 * @file LegalSubprocessorTable.tsx
 * @description Searchable table of infrastructure sub-processors, roles, transferred data, and security safeguards.
 * @architecture GDPR/privacy compliance component listing cloud partners (MongoDB, Cloudflare, Google, Cloudinary, Vercel).
 * @agent_note Includes client-side fuzzy searching across subprocessor names, roles, and transfer scopes.
 */

import { useState } from "react";
import {
  Database,
  Cloud,
  Image,
  ShieldCheck,
  Cpu,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";

interface Subprocessor {
  name: string;
  role: string;
  icon: typeof Database;
  dataTransferred: string;
  location: string;
  safeguards: string;
}

const SUBPROCESSORS: Subprocessor[] = [
  {
    name: "MongoDB Atlas",
    role: "Database & Metadata Management",
    icon: Database,
    dataTransferred:
      "User account profiles, hashed session tokens, template mappings, and batch metadata.",
    location: "AWS / GCP (US / EU regions)",
    safeguards:
      "Encrypted at rest (AES-256) and in transit (TLS 1.3), SOC 2 Type II, ISO 27001.",
  },
  {
    name: "Cloudflare (R2)",
    role: "Object Storage & Document Bundles",
    icon: Cloud,
    dataTransferred:
      "Private PDF template files, temporary recipient spreadsheets, compiled batch PDFs, and ZIP archives.",
    location: "Global Edge Network",
    safeguards:
      "AES-256 encryption at rest, short-lived scoped pre-signed URLs, strict TTL lifecycle rules.",
  },
  {
    name: "Cloudinary",
    role: "Media & Template Thumbnail Rendering",
    icon: Image,
    dataTransferred:
      "PDF template page previews and visual thumbnail images for template libraries.",
    location: "United States / EU (Cloud CDN)",
    safeguards:
      "HTTPS/TLS 1.3, authenticated URL access, strict API key isolation.",
  },
  {
    name: "Google Identity Services",
    role: "Authentication & Single Sign-On (SSO)",
    icon: ShieldCheck,
    dataTransferred:
      "OAuth 2.0 Subject ID (`sub`), registered email address, full name, and avatar URL.",
    location: "Global (Google Cloud)",
    safeguards:
      "OpenID Connect, zero password handling, token signature validation.",
  },
  {
    name: "Vercel",
    role: "Application Hosting & Edge Routing",
    icon: Cpu,
    dataTransferred:
      "Stateless HTTP requests, Web Vitals performance metrics (via Speed Insights).",
    location: "Global Edge Infrastructure",
    safeguards:
      "DDoS mitigation, TLS 1.3, SOC 2 Type II certified infrastructure.",
  },
];

/**
 * @component LegalSubprocessorTable
 * @description Renders a searchable data table of third-party vendors and data processors.
 * @state Manages local vendor query search filtering.
 */
export function LegalSubprocessorTable() {
  const [query, setQuery] = useState("");

  const filtered = SUBPROCESSORS.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.role.toLowerCase().includes(query.toLowerCase()) ||
      item.dataTransferred.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="my-6 space-y-3">
      {/* Search Filter */}
      <div className="relative max-w-xs">
        <label htmlFor="subprocessor-filter" className="sr-only">
          Filter sub-processors
        </label>
        <MagnifyingGlass
          size={16}
          weight="bold"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10 shrink-0"
        />
        <Input
          id="subprocessor-filter"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter sub-processors..."
          className="w-full pl-10 pr-8 h-9 text-xs rounded-xl bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus-visible:ring-blue-500/20 transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
            aria-label="Clear filter"
          >
            <X size={13} weight="bold" />
          </button>
        )}
      </div>

      {/* Responsive Table Card */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-sm bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
              <th className="py-3 px-4">Sub-Processor</th>
              <th className="py-3 px-4">Role / Purpose</th>
              <th className="py-3 px-4">Data Transferred</th>
              <th className="py-3 px-4">Region & Safeguards</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const Icon = item.icon;
              return (
                <tr
                  key={item.name}
                  className="hover:bg-slate-50/60 transition-colors"
                >
                  <td className="py-3.5 px-4 font-semibold text-slate-900 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/60">
                        <Icon size={16} weight="duotone" />
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 font-medium">
                    {item.role}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                    {item.dataTransferred}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="font-medium text-slate-700">
                      {item.location}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {item.safeguards}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-400">
                  No sub-processors match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 italic">
        * Sub-processors are bound by strict Data Processing Agreements (DPAs)
        requiring adherence to equivalent data protection standards.
      </p>
    </div>
  );
}
