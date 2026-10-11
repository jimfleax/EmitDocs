import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, FilePdf, Certificate, Calendar, CheckCircle } from '@phosphor-icons/react'
import { InfinityTrack } from '@/components/ui/InfinityTrack'

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
        <InfinityTrack className="text-blue-600" />
        <span className="text-sm font-medium text-slate-500">Loading template details...</span>
      </div>
    )
  }

  if (error || !template) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Link
          to="/app/templates"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          <span>Back to Templates</span>
        </Link>
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error || 'Template not found'}
        </div>
      </div>
    )
  }

  const currentVer =
    typeof template.currentVersionId === 'object' && template.currentVersionId !== null
      ? template.currentVersionId
      : null

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header with Back button */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
        <Link
          to="/app/templates"
          title="Back to Templates"
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer select-none shrink-0"
        >
          <ArrowLeft size={20} weight="bold" />
        </Link>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {template.name}
            </h1>
            <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
              {currentVer?.version ? `v${currentVer.version}` : 'v1'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 flex items-center gap-2 font-normal">
            <Calendar size={14} weight="bold" />
            <span>
              Created on{' '}
              {new Date(template.createdAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Preview Card */}
        <div className="md:col-span-1 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Document Preview
          </h3>
          <div className="aspect-[3/4] rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {template.thumbnailUrl ? (
              <img
                src={template.thumbnailUrl}
                alt={template.name}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full flex flex-col justify-between items-center text-center py-4">
                <Certificate size={36} weight="duotone" className="text-blue-600" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">{template.name}</p>
                  <p className="text-[10px] text-slate-400">PDF Template</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <CheckCircle size={10} weight="fill" />
                  <span>Ready</span>
                </div>
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
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/60">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
