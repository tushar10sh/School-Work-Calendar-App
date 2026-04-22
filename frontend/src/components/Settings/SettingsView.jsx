import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Loader2 } from 'lucide-react'
import { configApi, syncApi } from '../../api'
import WhatsAppPanel from '../WhatsApp/WhatsAppPanel'

function PurgeSection() {
  const queryClient = useQueryClient()
  const [confirmed, setConfirmed] = useState(false)

  const purgeMutation = useMutation({
    mutationFn: () => syncApi.purge(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      setConfirmed(false)
    },
  })

  return (
    <section className="bg-white rounded-lg border border-red-200 p-4">
      <h2 className="text-base font-semibold text-gray-800 mb-1">Re-sync Everything</h2>
      <p className="text-xs text-gray-500 mb-3">
        Clears the processed-message cache and all auto-detected events. The next sync will re-run every message through the AI parser from scratch.
      </p>

      {purgeMutation.isSuccess && (
        <p className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
          Cache cleared. Run a manual sync to reprocess all messages.
        </p>
      )}

      {!confirmed ? (
        <button
          onClick={() => setConfirmed(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-red-600 border border-red-300 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Trash2 size={14} />
          Clear Sync Cache
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">Are you sure? This will delete all auto-detected events.</span>
          <button
            onClick={() => purgeMutation.mutate()}
            disabled={purgeMutation.isPending}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {purgeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
            Yes, clear it
          </button>
          <button
            onClick={() => setConfirmed(false)}
            className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}

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

      {/* Purge / re-sync */}
      <PurgeSection />

      {/* Config info */}
      <section className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Configuration</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : config ? (
          <div className="space-y-5">
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
