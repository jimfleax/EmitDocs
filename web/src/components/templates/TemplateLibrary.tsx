import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Trash, FilePdf } from '@phosphor-icons/react'

type Template = {
  _id: string
  name: string
  ownerId: string
  currentVersionId?: string
  createdAt: string
  updatedAt: string
}

export function TemplateLibrary() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchTemplates = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/templates', {
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error('Failed to fetch templates')
      }
      const data = await res.json()
      setTemplates(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return
    try {
      const res = await fetch(`http://localhost:3000/api/templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Delete failed')
      setTemplates((prev) => prev.filter((t) => t._id !== id))
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) return <div>Loading templates...</div>
  if (error) return <div className="text-red-500">{error}</div>

  if (templates.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
        <FilePdf size={48} className="mx-auto mb-4 text-gray-400" />
        <p className="mb-4">No templates found.</p>
        <Link
          to="/app/templates/new"
          className="text-blue-600 hover:underline"
        >
          Upload your first template
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((template) => (
        <div
          key={template._id}
          className="bg-white border rounded-lg p-4 shadow-sm hover:shadow transition flex flex-col"
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-lg truncate" title={template.name}>
              {template.name}
            </h3>
            <button
              onClick={() => handleDelete(template._id)}
              className="text-gray-400 hover:text-red-500 transition"
              title="Delete"
            >
              <Trash size={20} />
            </button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Created: {new Date(template.createdAt).toLocaleDateString()}
          </p>
          <div className="mt-auto">
            <Link
              to="/app/templates/$templateId"
              params={{ templateId: template._id }}
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              View Details &rarr;
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}
