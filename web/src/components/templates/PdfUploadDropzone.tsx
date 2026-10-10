import { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { UploadSimple, FilePdf } from '@phosphor-icons/react'

export function PdfUploadDropzone() {
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a valid PDF file.')
        setFile(null)
        return
      }
      setFile(selectedFile)
      if (!name) {
        setName(selectedFile.name.replace(/\.[^/.]+$/, ''))
      }
      setError('')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.')
      return
    }
    if (!name.trim()) {
      setError('Please provide a name for the template.')
      return
    }

    setIsUploading(true)
    setError('')

    try {
      // 1. Get signature
      const signRes = await fetch('http://localhost:3000/api/templates/sign-upload', {
        method: 'POST',
        credentials: 'include',
      })

      if (!signRes.ok) {
        throw new Error('Failed to fetch upload signature')
      }

      const signData = await signRes.json()
      const { signature, timestamp, cloud_name, api_key, folder } = signData

      // 2. Upload to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', api_key)
      formData.append('timestamp', timestamp)
      formData.append('signature', signature)
      if (folder) formData.append('folder', folder)
      formData.append('type', 'authenticated')

      const cloudinaryRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/raw/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!cloudinaryRes.ok) {
        const cErr = await cloudinaryRes.json()
        throw new Error(cErr.error?.message || 'Failed to upload to Cloudinary')
      }

      const cloudinaryData = await cloudinaryRes.json()
      const cloudinaryPublicId = cloudinaryData.public_id

      // 3. Save to backend
      const saveRes = await fetch('http://localhost:3000/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name,
          cloudinaryPublicId,
          bytes: cloudinaryData.bytes,
        }),
      })

      if (!saveRes.ok) {
        throw new Error('Failed to save template to database')
      }

      const savedData = await saveRes.json()

      // 4. Navigate to template detail
      navigate({
        to: '/app/templates/$templateId',
        params: { templateId: savedData._id },
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Template Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="e.g. Invoice Template"
          disabled={isUploading}
        />
      </div>

      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:bg-gray-50 transition"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="application/pdf"
          className="hidden"
          disabled={isUploading}
        />
        {file ? (
          <div className="flex flex-col items-center">
            <FilePdf size={48} className="text-red-500 mb-2" />
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-gray-500">
            <UploadSimple size={48} className="mb-2" />
            <p className="font-medium">Click or drag PDF here to upload</p>
            <p className="text-sm mt-1">Maximum file size: 10MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 rounded text-sm">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!file || !name.trim() || isUploading}
          className="bg-blue-600 text-white px-6 py-2 rounded font-medium disabled:opacity-50 hover:bg-blue-700 transition"
        >
          {isUploading ? 'Uploading...' : 'Upload Template'}
        </button>
      </div>
    </div>
  )
}
