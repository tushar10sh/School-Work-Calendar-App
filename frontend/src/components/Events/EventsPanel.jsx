import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, X, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { eventsApi } from '../../api'

const EVENT_TYPES = ['HOLIDAY', 'SCHOOL_EVENT', 'PARENT_MEETING', 'OTHER']
const TYPE_LABELS = {
  HOLIDAY: 'Holiday',
  SCHOOL_EVENT: 'School Event',
  PARENT_MEETING: 'Parent Meeting',
  OTHER: 'Other',
}
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

const EMPTY_FORM = {
  title: '',
  description: '',
  event_date: format(new Date(), 'yyyy-MM-dd'),
  event_type: 'OTHER',
  color: '#10b981',
}

function SourceModal({ event, onClose }) {
  const sentAt = event.source_timestamp
    ? format(new Date(event.source_timestamp * 1000), 'dd MMM yyyy, h:mm a')
    : null
  const sender = event.source_sender || null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-800">{event.title}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(event.event_date + 'T00:00:00'), 'MMMM d, yyyy')} &bull;{' '}
              {TYPE_LABELS[event.event_type] || event.event_type}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {event.source_message ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <MessageSquare size={13} />
              <span>Original WhatsApp message</span>
              {sentAt && <span className="ml-auto">{sentAt}</span>}
            </div>
            {sender && (
              <p className="text-xs text-gray-400">
                From: <span className="font-medium text-gray-600">+{sender}</span>
              </p>
            )}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap border border-gray-100 max-h-64 overflow-y-auto">
              {event.source_message}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No source message (added manually)</p>
        )}

        {event.description && event.description !== event.source_message && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Summary</p>
            <p className="text-sm text-gray-700">{event.description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EventsPanel() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedEvent, setSelectedEvent] = useState(null)

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => eventsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => eventsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
      if (selectedEvent?.id === deleteMutation.variables) setSelectedEvent(null)
    },
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = events.filter((e) => e.event_date >= today)
  const past = events.filter((e) => e.event_date < today)

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Events</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Event
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">New Event</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Event title"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Type</label>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Color</label>
              <div className="flex gap-2 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      )}

      <EventList title="Upcoming" events={upcoming} onSelect={setSelectedEvent} onDelete={(id) => deleteMutation.mutate(id)} />
      {past.length > 0 && (
        <EventList title="Past" events={past} onSelect={setSelectedEvent} onDelete={(id) => deleteMutation.mutate(id)} muted />
      )}

      {selectedEvent && (
        <SourceModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  )
}

function EventList({ title, events, onSelect, onDelete, muted }) {
  if (!events.length) return null
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {events.map((ev) => (
          <div
            key={ev.id}
            onClick={() => onSelect(ev)}
            className={`flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2.5 group cursor-pointer hover:border-gray-300 hover:shadow-sm transition-all ${muted ? 'opacity-60' : ''}`}
          >
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
              <p className="text-xs text-gray-400">
                {format(new Date(ev.event_date + 'T00:00:00'), 'MMM d, yyyy')} &bull;{' '}
                {TYPE_LABELS[ev.event_type] || ev.event_type}
                {ev.source_sender && <span className="ml-1">· +{ev.source_sender}</span>}
              </p>
            </div>
            {ev.source_message && (
              <MessageSquare size={13} className="text-gray-300 flex-shrink-0" />
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(ev.id) }}
              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
