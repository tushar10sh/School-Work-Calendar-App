import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Loader2, CheckCircle, AlertCircle, ClipboardPaste } from 'lucide-react'
import { plannerApi } from '../../api'

const SAMPLE = `Todays planner- 21.4.26
Cw
Eng- Writing of words and new words of the poem in ECW.
M- Doing pages in MTB.
Pw
E- Revise A/An
H- writing vyanjan in HA
M- Do pw given in mtb

My bag- MTB, ETB.`

export default function ParseModal({ onClose, onDone }) {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)

  const parseMutation = useMutation({
    mutationFn: (msg) => plannerApi.parse(msg),
    onSuccess: (data) => {
      setResult({ success: true, data })
    },
    onError: (err) => {
      const detail = err?.response?.data?.detail || err.message || 'Parse failed'
      setResult({ success: false, error: detail })
    },
  })

  function handleParse() {
    if (!message.trim()) return
    setResult(null)
    parseMutation.mutate(message.trim())
  }

  function handleDone() {
    onDone(result?.data?.date || null)
  }

  function loadSample() {
    setMessage(SAMPLE)
    setResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Parse WhatsApp Message</h2>
            <p className="text-xs text-gray-500 mt-0.5">Paste your daily planner message below</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-gray-700">Message</label>
              <button
                onClick={loadSample}
                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                <ClipboardPaste size={12} />
                Load sample
              </button>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              placeholder={`Paste message here…\n\nExample:\nTodays planner- 21.4.26\nCw\nEng- Writing of words...`}
              className="w-full text-sm font-mono border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-300"
            />
          </div>

          {/* Result */}
          {result && (
            <div
              className={`rounded-lg p-3 text-sm ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {result.success ? (
                <div className="flex items-start gap-2 text-green-700">
                  <CheckCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Parsed successfully!</p>
                    <p className="text-xs mt-1 text-green-600">
                      Date: {result.data.date} &bull;{' '}
                      {result.data.classwork.length} classwork &bull;{' '}
                      {result.data.homework.length} homework &bull;{' '}
                      {result.data.bag_items.length} bag items
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Parse failed</p>
                    <p className="text-xs mt-1 text-red-500 break-all">{result.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {parseMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              Sending to Ollama… this may take 10-30 seconds
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          {result?.success ? (
            <button
              onClick={handleDone}
              className="px-4 py-2 text-sm font-medium bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              View on Calendar
            </button>
          ) : (
            <button
              onClick={handleParse}
              disabled={!message.trim() || parseMutation.isPending}
              className="px-4 py-2 text-sm font-medium bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {parseMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Parse
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
