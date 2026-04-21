import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { testAlertsApi, configApi } from '../../api'

const TEST_TYPES = ['UNIT_TEST', 'EXAM', 'ASSESSMENT', 'QUIZ']
const TYPE_LABELS = {
  UNIT_TEST: 'Unit Test',
  EXAM: 'Exam',
  ASSESSMENT: 'Assessment',
  QUIZ: 'Quiz',
}

const EMPTY_FORM = {
  subject: '',
  subject_name: '',
  test_date: format(new Date(), 'yyyy-MM-dd'),
  topics: '',
  test_type: 'UNIT_TEST',
  notes: '',
}

function Countdown({ testDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = parseISO(testDate)
  d.setHours(0, 0, 0, 0)
  const diff = differenceInDays(d, today)

  if (diff < 0) return <span className="text-xs text-gray-400">Past</span>
  if (diff === 0) return <span className="text-xs font-bold text-red-600 animate-pulse">TODAY!</span>
  if (diff === 1) return <span className="text-xs font-semibold text-orange-500">Tomorrow</span>
  if (diff <= 3) return <span className="text-xs font-semibold text-amber-500">In {diff} days</span>
  return <span className="text-xs text-gray-500">In {diff} days</span>
}

export default function TestAlertsView() {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [showUpcoming, setShowUpcoming] = useState(true)

  const { data: tests = [] } = useQuery({
    queryKey: ['test-alerts'],
    queryFn: () => testAlertsApi.list(),
  })

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
    staleTime: Infinity,
  })

  const createMutation = useMutation({
    mutationFn: (data) => testAlertsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => testAlertsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-alerts'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
    },
  })

  const today = format(new Date(), 'yyyy-MM-dd')
  const upcoming = tests.filter((t) => t.test_date >= today)
  const past = tests.filter((t) => t.test_date < today)
  const displayed = showUpcoming ? upcoming : past

  function handleSubjectChange(code) {
    const name = config?.subject_mappings?.[code] || code
    setForm({ ...form, subject: code, subject_name: name })
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.test_date) return
    const data = {
      ...form,
      topics: form.topics
        ? form.topics.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    }
    delete data.topics
    createMutation.mutate({
      subject: data.subject,
      subject_name: data.subject_name || data.subject,
      test_date: data.test_date,
      topics: form.topics ? form.topics.split(',').map((t) => t.trim()).filter(Boolean) : [],
      test_type: data.test_type,
      notes: data.notes || undefined,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Test Alerts</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Test
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-700">New Test Alert</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Subject Code *</label>
              {config?.subject_mappings ? (
                <select
                  value={form.subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  required
                >
                  <option value="">Select subject</option>
                  {Object.entries(config.subject_mappings).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value, subject_name: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="e.g. M"
                  required
                />
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Test Date *</label>
              <input
                type="date"
                value={form.test_date}
                onChange={(e) => setForm({ ...form, test_date: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Test Type</label>
              <select
                value={form.test_type}
                onChange={(e) => setForm({ ...form, test_type: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {TEST_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Topics (comma-separated)</label>
              <input
                value={form.topics}
                onChange={(e) => setForm({ ...form, topics: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="e.g. Chapter 1, Fractions"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Notes</label>
              <input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors">
              Save
            </button>
          </div>
        </form>
      )}

      {/* Toggle upcoming / past */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setShowUpcoming(true)}
          className={`text-sm px-3 py-1 rounded-md transition-colors ${showUpcoming ? 'bg-white shadow-sm font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          onClick={() => setShowUpcoming(false)}
          className={`text-sm px-3 py-1 rounded-md transition-colors ${!showUpcoming ? 'bg-white shadow-sm font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Past ({past.length})
        </button>
      </div>

      {displayed.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No {showUpcoming ? 'upcoming' : 'past'} tests</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {displayed.map((test) => (
            <div key={test.id} className="bg-white rounded-lg border border-gray-200 p-3 group relative">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-gray-800">{test.subject_name}</p>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(test.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">
                  {TYPE_LABELS[test.test_type] || test.test_type}
                </span>
                <span className="text-xs text-gray-500">
                  {format(parseISO(test.test_date), 'MMM d, yyyy')}
                </span>
                <Countdown testDate={test.test_date} />
              </div>
              {test.topics.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {test.topics.map((topic, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {topic}
                    </span>
                  ))}
                </div>
              )}
              {test.notes && <p className="text-xs text-gray-400 mt-1.5">{test.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
