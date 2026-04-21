import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Lock, Plus, X, Loader2 } from 'lucide-react'
import { childrenApi } from '../../api'

const CHILD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

function PinModal({ child, onLogin, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pin) return
    setLoading(true)
    setError('')
    try {
      await onLogin(child.id, pin)
    } catch {
      setError('Wrong PIN. Try again.')
      setPin('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: child.color }}
            >
              {child.name[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-gray-800">{child.name}</p>
              <p className="text-xs text-gray-400">Enter PIN to continue</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            autoFocus
            className="w-full text-center text-2xl tracking-widest border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            disabled={!pin || loading}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            <Lock size={15} />
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

function AddChildModal({ onClose, onCreated }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ name: '', pin: '', confirmPin: '', color: CHILD_COLORS[0] })
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: (data) => childrenApi.create(data),
    onSuccess: (child) => {
      queryClient.invalidateQueries({ queryKey: ['children'] })
      onCreated(child)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.pin.length < 4) return setError('PIN must be at least 4 digits')
    if (form.pin !== form.confirmPin) return setError('PINs do not match')
    createMutation.mutate({ name: form.name, pin: form.pin, color: form.color })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Add Child Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Child's name *"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => setForm({ ...form, pin: e.target.value })}
            placeholder="Create PIN (min 4 digits) *"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            inputMode="numeric"
            value={form.confirmPin}
            onChange={(e) => setForm({ ...form, confirmPin: e.target.value })}
            placeholder="Confirm PIN *"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Profile color</p>
            <div className="flex gap-2">
              {CHILD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {createMutation.error && (
            <p className="text-xs text-red-500">
              {createMutation.error?.response?.data?.detail || 'Failed to create'}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 text-sm text-gray-500 hover:text-gray-700 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage({ onLogin }) {
  const [selectedChild, setSelectedChild] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['children'],
    queryFn: () => childrenApi.list(),
  })

  function handleChildCreated(child) {
    setShowAddModal(false)
    setSelectedChild(child)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500 rounded-2xl shadow-lg mb-3">
            <BookOpen size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">School Planner</h1>
          <p className="text-gray-500 text-sm mt-1">Select your profile to continue</p>
        </div>

        {/* Child cards */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : children.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm mb-4">No profiles yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {children.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChild(child)}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-200 transition-all text-left group"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mb-2 shadow"
                  style={{ backgroundColor: child.color }}
                >
                  {child.name[0].toUpperCase()}
                </div>
                <p className="font-medium text-gray-800 text-sm group-hover:text-blue-600 transition-colors">
                  {child.name}
                </p>
                {child.whatsapp_group_name && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{child.whatsapp_group_name}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Add child button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 hover:border-blue-400 text-gray-500 hover:text-blue-500 rounded-xl py-3 text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Add Child Profile
        </button>
      </div>

      {/* PIN modal */}
      {selectedChild && (
        <PinModal
          child={selectedChild}
          onLogin={onLogin}
          onClose={() => setSelectedChild(null)}
        />
      )}

      {/* Add child modal */}
      {showAddModal && (
        <AddChildModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleChildCreated}
        />
      )}
    </div>
  )
}
