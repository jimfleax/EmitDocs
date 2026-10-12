import { useState, useRef } from 'react'
import type { ChangeEvent, DragEvent, FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  UploadSimple,
  FilePdf,
  CloudArrowUp,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/components/ui/toast'

interface SignUploadResponse {
  signature: string
  timestamp: number | string
  cloud_name: string
  api_key: string
  folder?: string
}

interface CloudinaryUploadResponse {
  public_id: string
  bytes?: number
  error?: {
    message?: string
  }
}

interface TemplateCreateResponse {
  _id?: string
  template?: {
    _id: string
    name: string
  }
  error?: string
  details?: string
  message?: string
}

export function PdfUploadDropzone() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const validateAndSetFile = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.')
      return
    }

    const maxBytes = 25 * 1024 * 1024
    if (selectedFile.size > maxBytes) {
      setError('File size exceeds the 25MB limit.')
      return
    }

    setFile(selectedFile)
    setError('')

    setName((prevName) => {
      if (!prevName.trim()) {
        return selectedFile.name.replace(/\.[^/.]+$/, '')
      }
      return prevName
    })
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
    // Clear input value so identical file selection re-triggers change handler
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (isUploading) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async (e?: FormEvent) => {
    if (e) e.preventDefault()

    if (!file) {
      setError('Please select a PDF file to upload.')
      return
    }
    if (!name.trim()) {
      setError('Please provide a name for the template.')
      return
    }

    setIsUploading(true)
    setError('')
    setUploadProgress(10)

    try {
      // 1. Get upload signature from relative backend endpoint
      const signRes = await fetch('/api/templates/sign-upload', {
        method: 'POST',
        credentials: 'include',
      })

      if (!signRes.ok) {
        const errJson = await signRes.json().catch(() => ({}))
        throw new Error(errJson.error || errJson.message || `Failed to fetch upload signature (${signRes.status})`)
      }

      const signData: SignUploadResponse = await signRes.json()
      const { signature, timestamp, cloud_name, api_key, folder } = signData

      if (!signature || !cloud_name || !api_key) {
        throw new Error('Incomplete signature credentials received from server.')
      }

      setUploadProgress(25)

      // 2. Upload to Cloudinary with real progress tracking via XMLHttpRequest
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', api_key)
      formData.append('timestamp', String(timestamp))
      formData.append('signature', signature)
      if (folder) formData.append('folder', folder)
      formData.append('type', 'authenticated')

      const cloudinaryData = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            // Map 0-100% upload progress to 25% - 85% range
            const mapped = 25 + Math.round((event.loaded / event.total) * 60)
            setUploadProgress(mapped)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const resData: CloudinaryUploadResponse = JSON.parse(xhr.responseText)
              resolve(resData)
            } catch {
              reject(new Error('Failed to parse Cloudinary response.'))
            }
          } else {
            try {
              const cErr = JSON.parse(xhr.responseText)
              reject(new Error(cErr.error?.message || 'Failed to upload document to Cloudinary.'))
            } catch {
              reject(new Error(`Cloudinary upload failed with status ${xhr.status}.`))
            }
          }
        }

        xhr.onerror = () => reject(new Error('Network error during file upload to Cloudinary.'))
        xhr.send(formData)
      })

      setUploadProgress(90)

      // 3. Save template to database using relative backend endpoint
      const saveRes = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          cloudinaryPublicId: cloudinaryData.public_id,
          bytes: cloudinaryData.bytes ?? file.size,
        }),
      })

      if (!saveRes.ok) {
        const saveErr: TemplateCreateResponse = await saveRes.json().catch(() => ({}))
        const errorMessage = saveErr.details
          ? `${saveErr.error || 'Failed to save template'}: ${saveErr.details}`
          : saveErr.error || saveErr.message || `Failed to save template to database (${saveRes.status})`
        throw new Error(errorMessage)
      }

      const savedData: TemplateCreateResponse = await saveRes.json()
      setUploadProgress(100)

      // 4. Navigate to template detail page
      const templateId = savedData?.template?._id || savedData?._id
      if (!templateId) {
        throw new Error('Template created but no template ID was returned.')
      }

      toast.success('Template Uploaded', `Template "${name.trim()}" created successfully.`)

      navigate({
        to: '/app/templates/$templateId',
        params: { templateId },
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during upload.'
      setError(message)
      toast.error('Upload Failed', message)
      setUploadProgress(0)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Form Input: Template Name */}
      <div className="space-y-1.5">
        <label htmlFor="template-name" className="block text-sm font-semibold text-slate-800">
          Template Name <span className="text-rose-500">*</span>
        </label>
        <input
          id="template-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Workshop Certificate of Completion"
          disabled={isUploading}
          className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 placeholder:text-slate-400 disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-slate-400 font-normal">
          A descriptive name for your certificate or credential layout.
        </p>
      </div>

      {/* Dropzone Area or Inspector State */}
      {!file ? (
        <div
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-3 group ${
            isDragging
              ? 'border-blue-500 bg-blue-50/40'
              : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 shadow-xs ${
              isDragging
                ? 'bg-blue-100 text-blue-600 scale-105'
                : 'bg-white text-slate-500 group-hover:text-blue-600 group-hover:scale-105 border border-slate-200/80'
            }`}
          >
            <UploadSimple size={28} weight="bold" />
          </div>

          <div className="space-y-1">
            <p className="text-sm sm:text-base font-bold text-slate-800">
              Drag &amp; drop your PDF here, or <span className="text-blue-600 underline underline-offset-2">click to browse</span>
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Max file size: 25MB · Format: .pdf
            </p>
          </div>
        </div>
      ) : (
        /* File Selected Inspector State */
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6 transition-all space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0 shadow-2xs">
                <FilePdf size={28} weight="duotone" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-sm sm:text-base text-slate-900 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <Badge variant="success" size="sm" shape="pill" dot className="shrink-0">
                    Ready
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(2)} MB · PDF Document
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => !isUploading && fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl shadow-2xs transition-all cursor-pointer select-none shrink-0 disabled:opacity-50"
            >
              <span>Change file</span>
            </button>
          </div>

          <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Ready for signed Cloudinary upload
            </span>
            <span>PDF Document</span>
          </div>
        </div>
      )}

      {/* Upload Progress Bar */}
      {isUploading && (
        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              {uploadProgress >= 90 ? 'Finalizing template registration...' : 'Uploading PDF document...'}
            </span>
            <span className="text-blue-600 font-bold">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <Alert
          variant="error"
          onDismiss={() => setError('')}
          className="animate-in fade-in duration-200"
        >
          {error}
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Link
          to="/app/templates"
          className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer select-none text-center"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={!file || !name.trim() || isUploading}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer select-none text-xs sm:text-sm disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <Spinner size="md" variant="current" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <CloudArrowUp size={18} weight="bold" />
              <span>Upload Template</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
