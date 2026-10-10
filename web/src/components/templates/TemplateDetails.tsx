import { useEffect, useState } from 'react'

type TemplateVersion = {
  _id: string
  version: number
  createdAt: string
}

type Template = {
  _id: string
  name: string
  createdAt: string
}

export function TemplateDetails({ templateId }: { templateId: string }) {
  const [template, setTemplate] = useState<Template | null>(null)
  const [versions, setVersions] = useState<TemplateVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tplRes, verRes] = await Promise.all([
          fetch(`http://localhost:3000/api/templates/${templateId}`, { credentials: 'include' }),
          fetch(`http://localhost:3000/api/templates/${templateId}/versions`, { credentials: 'include' })
        ])

        if (!tplRes.ok) throw new Error('Failed to fetch template')
        
        const tplData = await tplRes.json()
        setTemplate(tplData)

        if (verRes.ok) {
          const verData = await verRes.json()
          setVersions(verData)
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [templateId])

  if (loading) return <div>Loading details...</div>
  if (error) return <div className="text-red-500">{error}</div>
  if (!template) return <div>Template not found</div>

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">{template.name}</h3>
        <p className="text-sm text-gray-500">
          Created: {new Date(template.createdAt).toLocaleString()}
        </p>
      </div>

      <div>
        <h4 className="text-lg font-medium mb-3">Versions</h4>
        {versions.length === 0 ? (
          <p className="text-gray-500 text-sm">No versions found.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map(v => (
              <li key={v._id} className="p-3 border rounded flex justify-between items-center">
                <span className="font-medium">Version {v.version}</span>
                <span className="text-sm text-gray-500">
                  {new Date(v.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
