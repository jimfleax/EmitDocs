import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { FilePdf, Certificate, Calendar } from '@phosphor-icons/react'
import { PageShell } from '@/components/layout/PageShell'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'

interface TemplateVersion {
  _id: string
  version: number
  pageCount?: number
  bytes?: number
  sourceObjectKey?: string
  status?: string
  createdAt: string
}

interface Template {
  _id: string
  name: string
  thumbnailUrl?: string
  currentVersionId?: string | TemplateVersion
  createdAt: string
  updatedAt?: string
}

export function TemplateDetails({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageErrorUrl, setImageErrorUrl] = useState<string | null>(null)
  const hasImageError = !!template?.thumbnailUrl && imageErrorUrl === template.thumbnailUrl

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/templates/${templateId}`, { credentials: 'include' })

        if (!res.ok) {
          throw new Error(`Failed to fetch template (${res.status})`)
        }

        const data = await res.json()
        const tpl = data?.template || data
        setTemplate(tpl)

        if (tpl?.currentVersionId && typeof tpl.currentVersionId === 'object') {
          setVersions([tpl.currentVersionId])
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load template details'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [templateId])

  const currentVer =
    template && typeof template.currentVersionId === 'object' && template.currentVersionId !== null
      ? template.currentVersionId
      : null

  return (
    <PageShell
      title={
        template ? (
          <span className="flex items-center gap-2.5">
            {template.name}
            <Badge variant="primary" size="md" shape="rounded" mono>
              {currentVer?.version ? `v${currentVer.version}` : 'v1'}
            </Badge>
          </span>
        ) : (
          'Template Details'
        )
      }
      subtitle={
        template ? (
          <span className="flex items-center gap-2">
            <Calendar size={14} weight="bold" />
            Created on{' '}
            {new Date(template.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        ) : undefined
      }
      backTo="/app/templates"
      backLabel="Back to Templates"
      isLoading={loading}
      loadingTitle="Loading template details..."
      maxWidth="full"
      actions={
        currentVer?._id && template ? (
          <Link
            to="/app/templates/$templateId/versions/$versionId"
            params={{ templateId: template._id, versionId: currentVer._id }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <span>Map Fields & Preview</span>
            <span>→</span>
          </Link>
        ) : undefined
      }
    >
      {error || !template ? (
        <Alert variant="error">
          {error || 'Template not found'}
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Preview Card */}
        <div className="md:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Document Preview
          </h3>
          <div className="aspect-[3/4] rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {template.thumbnailUrl && !hasImageError ? (
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                onError={() => setImageErrorUrl(template.thumbnailUrl || null)}
                className="w-full h-full object-cover rounded-lg shadow-xs"
              />
            ) : (
              <div className="w-full h-full flex flex-col justify-between items-center text-center py-4">
                <Certificate size={36} weight="duotone" className="text-blue-600" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">{template.name}</p>
                  <p className="text-[10px] text-slate-400">PDF Template</p>
                </div>
                <Badge variant="success" size="sm" shape="pill" dot>
                  Ready
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Version History & Metadata */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Template Information</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-medium">Pages</span>
                <span className="text-slate-800 font-bold text-sm mt-0.5 block">
                  {currentVer?.pageCount || 1}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-medium">File Size</span>
                <span className="text-slate-800 font-bold text-sm mt-0.5 block">
                  {currentVer?.bytes
                    ? `${(currentVer.bytes / 1024 / 1024).toFixed(2)} MB`
                    : 'PDF'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Version History</h3>
              <span className="text-xs text-slate-400 font-medium">
                {versions.length} {versions.length === 1 ? 'version' : 'versions'}
              </span>
            </div>

            <div className="space-y-2">
              {versions.length === 0 ? (
                <p className="text-xs text-slate-400">No version history available.</p>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver._id}
                    className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                        <FilePdf size={16} weight="bold" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Version {ver.version}</p>
                        <p className="text-slate-400 text-[11px]">
                          {new Date(ver.createdAt || template.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="success" size="sm" shape="pill">
                        v{ver.version}
                      </Badge>
                      <Link
                        to="/app/templates/$templateId/versions/$versionId"
                        params={{ templateId: template._id, versionId: ver._id }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Map Fields
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        </div>
      )}
    </PageShell>
  )
}

