import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { FilePdf, Sparkle } from '@phosphor-icons/react';
import { PageShell } from '@/components/layout/PageShell';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';

interface Template {
  _id: string;
  name: string;
  currentVersionId?: string;
  thumbnailUrl?: string;
  updatedAt?: string;
}

function formatDefaultBatchName(templateName: string): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${templateName} — ${dateStr}`;
}

function BatchTemplateThumbnail({ url }: { url?: string }) {
  const [errorUrl, setErrorUrl] = useState<string | null>(null);
  const hasError = errorUrl === url;

  if (url && !hasError) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setErrorUrl(url)}
        className="w-full h-full object-cover"
      />
    );
  }
  return <FilePdf className="w-5 h-5 text-blue-500" />;
}

export function NewBatchForm() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [batchName, setBatchName] = useState<string>('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const res = await fetch('/api/templates', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load templates');
        const data = await res.json();
        const list: Template[] = data.templates || [];
        setTemplates(list);
        if (list.length > 0) {
          setSelectedTemplateId(list[0]._id);
          setBatchName(formatDefaultBatchName(list[0].name));
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching templates');
      } finally {
        setIsLoadingTemplates(false);
      }
    }
    fetchTemplates();
  }, []);

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const tmpl = templates.find((t) => t._id === id);
    if (tmpl) {
      setBatchName(formatDefaultBatchName(tmpl.name));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !batchName.trim()) {
      setError('Please choose a template and specify a batch name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: batchName.trim(),
          templateId: selectedTemplateId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create batch');
      }

      const { batch } = await res.json();
      navigate({ to: '/app/batches/$batchId/import', params: { batchId: batch._id } });
    } catch (err: any) {
      setError(err.message || 'Error creating batch');
      setIsSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Start New Issuance Batch"
      subtitle="Select a template and configure batch settings to begin spreadsheet data import."
      backTo="/app"
      backLabel="Back to Dashboard"
      maxWidth="2xl"
      isLoading={isLoadingTemplates}
      loadingTitle="Loading your template library..."
    >
      {error && (
        <Alert variant="error" className="mb-6">
          {error}
        </Alert>
      )}

      {templates.length === 0 ? (
        <EmptyState
          icon={<FilePdf size={28} weight="duotone" />}
          title="No Templates Found"
          description="You must upload and configure at least one template before creating a batch."
          variant="solid"
          action={
            <Link
              to="/app/templates/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-900 text-xs font-semibold text-white transition-all shadow-sm cursor-pointer select-none"
            >
              Upload New Template
            </Link>
          }
        />
      ) : (
        <form onSubmit={handleCreate} className="space-y-6">
          {/* Batch Name */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Batch Name
            </label>
            <input
              type="text"
              required
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder="e.g. Summer 2026 Certificates"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition-all shadow-xs"
            />
          </div>

          {/* Template Picker */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Select Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {templates.map((tmpl) => {
                const isSelected = tmpl._id === selectedTemplateId;
                return (
                  <div
                    key={tmpl._id}
                    onClick={() => handleSelectTemplate(tmpl._id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400/50 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                        <BatchTemplateThumbnail url={tmpl.thumbnailUrl} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">{tmpl.name}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {tmpl.currentVersionId ? 'Configured & Active' : 'Draft'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || !selectedTemplateId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 active:scale-[0.98] disabled:opacity-50 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer select-none"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" variant="current" />
                  Creating Batch...
                </>
              ) : (
                <>
                  <Sparkle className="w-4 h-4" />
                  Continue to Import
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </PageShell>
  );
}
