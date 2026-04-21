import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, BookOpen, Home, ShoppingBag, CheckCircle, Circle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { plannerApi, eventsApi, testAlertsApi } from '../../api'

function EntryItem({ entry, onToggle, onDelete }) {
  return (
    <div className={`flex items-start gap-2 py-1.5 group ${entry.is_completed ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onToggle(entry.id)}
        className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
      >
        {entry.is_completed ? (
          <CheckCircle size={16} className="text-green-500" />
        ) : (
          <Circle size={16} />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <span className="inline-block bg-gray-100 text-gray-600 text-xs font-medium px-1.5 py-0.5 rounded mr-1.5">
          {entry.subject_name}
        </span>
        <span className={`text-sm text-gray-700 ${entry.is_completed ? 'line-through' : ''}`}>
          {entry.task}
        </span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export default function DayPanel({ date, onClose }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['planner-day', date],
    queryFn: () => plannerApi.getByDate(date),
    enabled: !!date,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events-day', date],
    queryFn: () => eventsApi.list({ event_date: date }),
    enabled: !!date,
  })

  const { data: tests = [] } = useQuery({
    queryKey: ['tests-day', date],
    queryFn: () => testAlertsApi.list({ upcoming: false }),
    enabled: !!date,
    select: (all) => all.filter((t) => t.test_date === date),
  })

  const toggleMutation = useMutation({
    mutationFn: (id) => plannerApi.toggleComplete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['planner-day', date] })
      const prev = queryClient.getQueryData(['planner-day', date])
      queryClient.setQueryData(['planner-day', date], (old) => {
        if (!old) return old
        const toggle = (list) =>
          list.map((e) => (e.id === id ? { ...e, is_completed: !e.is_completed } : e))
        return { ...old, classwork: toggle(old.classwork), homework: toggle(old.homework) }
      })
      return { prev }
    },
    onError: (_, __, ctx) => {
      queryClient.setQueryData(['planner-day', date], ctx?.prev)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['planner-day', date] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => plannerApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planner-day', date] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
    },
  })

  const displayDate = date
    ? format(new Date(date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')
    : ''

  return (
    <div className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col max-h-[calc(100vh-140px)] overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Daily Overview</p>
          <p className="text-sm font-semibold text-gray-800 mt-0.5">{displayDate}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={18} />
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent" />
        </div>
      ) : (
        <div className="flex-1 p-4 space-y-5">
          {/* Classwork */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
              <BookOpen size={13} />
              Classwork
            </h3>
            {data?.classwork?.length ? (
              <div className="space-y-0.5">
                {data.classwork.map((entry) => (
                  <EntryItem
                    key={entry.id}
                    entry={entry}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No classwork</p>
            )}
          </section>

          {/* Homework */}
          <section>
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">
              <Home size={13} />
              Homework / Practice
            </h3>
            {data?.homework?.length ? (
              <div className="space-y-0.5">
                {data.homework.map((entry) => (
                  <EntryItem
                    key={entry.id}
                    entry={entry}
                    onToggle={(id) => toggleMutation.mutate(id)}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No homework</p>
            )}
          </section>

          {/* Bag */}
          {data?.bag_items?.length > 0 && (
            <section>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
                <ShoppingBag size={13} />
                My Bag
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.bag_items.map((bag) => (
                  <span
                    key={bag.id}
                    className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-1 rounded-full border border-purple-100"
                  >
                    {bag.item}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Events */}
          {events.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">Events</h3>
              <div className="space-y-1">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 rounded px-2 py-1"
                  >
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: ev.color }}
                    />
                    <span className="font-medium">{ev.title}</span>
                    {ev.description && (
                      <span className="text-gray-400 text-xs truncate">{ev.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tests */}
          {tests.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">Tests</h3>
              <div className="space-y-1">
                {tests.map((t) => (
                  <div key={t.id} className="bg-red-50 rounded px-2 py-1.5">
                    <p className="text-sm font-medium text-red-700">{t.subject_name}</p>
                    <p className="text-xs text-red-500 capitalize">{t.test_type.replace('_', ' ')}</p>
                    {t.topics.length > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.topics.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!data?.classwork?.length &&
            !data?.homework?.length &&
            !events.length &&
            !tests.length && (
              <p className="text-center text-gray-400 text-sm py-8">Nothing planned for this day</p>
            )}
        </div>
      )}
    </div>
  )
}
