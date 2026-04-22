import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Trash2, X, MessageSquare, CheckCircle2, Circle, ArrowUpDown,
  Edit2, Archive, ArchiveX, Filter,
} from 'lucide-react'
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

function EventFormModal({ event, onClose, onSave, isPending }) {
  const [form, setForm] = useState({
    title: event.title,
    description: event.description || '',
    event_date: event.event_date,
    event_type: event.event_type,
    color: event.color,
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    onSave(form)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Edit Event</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
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

          {event.source_message && (
            <p className="text-xs text-blue-500 bg-blue-50 rounded px-2 py-1">
              This event was auto-detected — date/title corrections are logged for model improvement.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function EventsPanel({ highlightDate, onHighlightClear }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [highlightedIds, setHighlightedIds] = useState(new Set())
  const rowRefs = useRef({})

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => eventsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
      setEditingEvent(null)
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

  const actionMutation = useMutation({
    mutationFn: ({ id, action_taken }) => eventsApi.update(id, { action_taken }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, is_archived }) => eventsApi.update(id, { is_archived }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })

  // Highlight rows when navigated from calendar
  useEffect(() => {
    if (!highlightDate || !events.length) return

    const matching = events.filter((e) => e.event_date === highlightDate)
    if (!matching.length) return

    const ids = new Set(matching.map((e) => e.id))
    setHighlightedIds(ids)

    setTimeout(() => {
      rowRefs.current[matching[0].id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)

    const timer = setTimeout(() => {
      setHighlightedIds(new Set())
      onHighlightClear?.()
    }, 2000)

    return () => clearTimeout(timer)
  }, [highlightDate, events]) // eslint-disable-line react-hooks/exhaustive-deps

  const setRowRef = useCallback((id, el) => {
    if (el) rowRefs.current[id] = el
    else delete rowRefs.current[id]
  }, [])

  const today = format(new Date(), 'yyyy-MM-dd')

  // Apply filters before split
  const filtered = [...events]
    .filter((e) => (showArchived ? e.is_archived : !e.is_archived))
    .filter((e) => (pendingOnly ? !e.action_taken : true))
    .sort((a, b) => {
      const cmp = a.event_date.localeCompare(b.event_date)
      return sortAsc ? cmp : -cmp
    })

  const upcoming = filtered.filter((e) => e.event_date >= today)
  const past = filtered.filter((e) => e.event_date < today)

  const archivedCount = events.filter((e) => e.is_archived).length

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    createMutation.mutate(form)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-gray-800">Events</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Pending filter */}
          <button
            onClick={() => setPendingOnly((v) => !v)}
            title={pendingOnly ? 'Showing: Pending only' : 'Showing: All events'}
            className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
              pendingOnly
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 bg-white'
            }`}
          >
            <Filter size={12} />
            {pendingOnly ? 'Pending only' : 'All'}
          </button>
          {/* Sort toggle */}
          <button
            onClick={() => setSortAsc((v) => !v)}
            title={sortAsc ? 'Showing: Soonest first' : 'Showing: Latest first'}
            className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700 bg-white px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <ArrowUpDown size={12} />
            {sortAsc ? 'Soonest first' : 'Latest first'}
          </button>
          {/* Archive toggle */}
          {archivedCount > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className={`flex items-center gap-1.5 text-xs border px-2.5 py-1.5 rounded-lg transition-colors ${
                showArchived
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700 bg-white'
              }`}
            >
              {showArchived ? <ArchiveX size={12} /> : <Archive size={12} />}
              {showArchived ? 'Hide archived' : `Archived (${archivedCount})`}
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Add Event
          </button>
        </div>
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

      <EventList
        title={showArchived ? 'Archived — Upcoming' : 'Upcoming'}
        events={upcoming}
        onSelect={setSelectedEvent}
        onEdit={setEditingEvent}
        onDelete={(id) => deleteMutation.mutate(id)}
        onToggleAction={(ev) => actionMutation.mutate({ id: ev.id, action_taken: !ev.action_taken })}
        onToggleArchive={(ev) => archiveMutation.mutate({ id: ev.id, is_archived: !ev.is_archived })}
        highlightedIds={highlightedIds}
        setRowRef={setRowRef}
        showArchived={showArchived}
      />
      {past.length > 0 && (
        <EventList
          title={showArchived ? 'Archived — Past' : 'Past'}
          events={past}
          onSelect={setSelectedEvent}
          onEdit={setEditingEvent}
          onDelete={(id) => deleteMutation.mutate(id)}
          onToggleAction={(ev) => actionMutation.mutate({ id: ev.id, action_taken: !ev.action_taken })}
          onToggleArchive={(ev) => archiveMutation.mutate({ id: ev.id, is_archived: !ev.is_archived })}
          highlightedIds={highlightedIds}
          setRowRef={setRowRef}
          showArchived={showArchived}
          muted
        />
      )}

      {selectedEvent && (
        <SourceModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
      {editingEvent && (
        <EventFormModal
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={(data) => updateMutation.mutate({ id: editingEvent.id, data })}
          isPending={updateMutation.isPending}
        />
      )}
    </div>
  )
}

function EventList({ title, events, onSelect, onEdit, onDelete, onToggleAction, onToggleArchive, highlightedIds, setRowRef, showArchived, muted }) {
  if (!events.length) return null
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</h3>
      <div className="space-y-2">
        {events.map((ev) => {
          const isHighlighted = highlightedIds.has(ev.id)
          return (
            <div
              key={ev.id}
              ref={(el) => setRowRef(ev.id, el)}
              onClick={() => onSelect(ev)}
              className={`flex items-center gap-3 bg-white rounded-lg border px-3 py-2.5 group cursor-pointer transition-all duration-300 ${
                isHighlighted
                  ? 'border-amber-400 shadow-md ring-2 ring-amber-300 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              } ${muted && !isHighlighted ? 'opacity-60' : ''}`}
            >
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color }} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${ev.action_taken ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {ev.title}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(ev.event_date + 'T00:00:00'), 'MMM d, yyyy')} &bull;{' '}
                  {TYPE_LABELS[ev.event_type] || ev.event_type}
                  {ev.source_sender && <span className="ml-1">· +{ev.source_sender}</span>}
                </p>
              </div>
              {ev.source_message && (
                <MessageSquare size={13} className="text-gray-300 flex-shrink-0" />
              )}
              {/* Edit */}
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(ev) }}
                title="Edit event"
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-400 transition-all flex-shrink-0"
              >
                <Edit2 size={13} />
              </button>
              {/* Archive / unarchive */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleArchive(ev) }}
                title={ev.is_archived ? 'Unarchive' : 'Archive'}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-purple-400 transition-all flex-shrink-0"
              >
                {ev.is_archived ? <ArchiveX size={13} /> : <Archive size={13} />}
              </button>
              {/* Action taken toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleAction(ev) }}
                title={ev.action_taken ? 'Mark as pending' : 'Mark action taken'}
                className={`flex-shrink-0 transition-colors ${
                  ev.action_taken
                    ? 'text-green-500 hover:text-gray-400'
                    : 'text-gray-200 hover:text-green-400 opacity-0 group-hover:opacity-100'
                }`}
              >
                {ev.action_taken ? <CheckCircle2 size={15} /> : <Circle size={15} />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(ev.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
