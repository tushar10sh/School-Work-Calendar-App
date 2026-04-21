import { useQuery } from '@tanstack/react-query'
import { configApi } from '../../api'
import EventsPanel from '../Events/EventsPanel'
import WhatsAppPanel from '../WhatsApp/WhatsAppPanel'

export default function SettingsView({ child, onChildUpdate }) {
  const { data: config, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Infinity,
  })

  return (
    <div className="space-y-6 max-w-2xl">
      {/* WhatsApp section */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4">WhatsApp Sync</h2>
        <WhatsAppPanel child={child} onChildUpdate={onChildUpdate} />
      </section>

      {/* Events section */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <EventsPanel />
      </section>

      {/* Config info */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Configuration</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : config ? (
          <div className="space-y-5">
            {/* Ollama */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Ollama (AI Parser)
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 flex-shrink-0">Model</span>
                  <code className="text-blue-600 font-mono">{config.ollama_model}</code>
                </div>
                <div className="flex gap-3">
                  <span className="text-gray-500 w-24 flex-shrink-0">URL</span>
                  <code className="text-gray-600 font-mono text-xs break-all">{config.ollama_base_url}</code>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Change model in <code className="text-gray-600">config.yaml</code> → restart backend container.
              </p>
            </div>

            {/* Subject mappings */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Subject Code Mappings
              </h3>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Code</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Full Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(config.subject_mappings).map(([code, name], i) => (
                      <tr key={code} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="py-1.5 px-3">
                          <code className="text-blue-600 font-mono text-xs font-medium">{code}</code>
                        </td>
                        <td className="py-1.5 px-3 text-gray-700">{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-400">Failed to load config</p>
        )}
      </section>
    </div>
  )
}
