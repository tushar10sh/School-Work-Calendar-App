import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { summaryApi } from '../../api'

const PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
]

function getRange(period) {
  const now = new Date()
  if (period === 'week') {
    return {
      start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    }
  }
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
  }
}

function StatCard({ label, done, total, color }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const barColor = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  }[color] || 'bg-gray-400'

  const textColor = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
    purple: 'text-purple-600',
  }[color] || 'text-gray-600'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <span className={`text-2xl font-bold ${textColor}`}>{pct}%</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">
        {total === 0 ? 'No entries' : `${done} of ${total} completed`}
      </p>
    </div>
  )
}

export default function SummaryView() {
  const [period, setPeriod] = useState('week')
  const range = getRange(period)

  const { data, isLoading } = useQuery({
    queryKey: ['summary', range.start, range.end],
    queryFn: () => summaryApi.get(range.start, range.end),
  })

  const label = period === 'week'
    ? `${format(new Date(range.start + 'T00:00:00'), 'MMM d')} – ${format(new Date(range.end + 'T00:00:00'), 'MMM d, yyyy')}`
    : format(new Date(range.start + 'T00:00:00'), 'MMMM yyyy')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Progress Summary</h2>
          <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(({ id, label: l }) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`text-sm px-3 py-1 rounded-md transition-colors ${
                period === id ? 'bg-white shadow-sm font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 h-28 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Classwork"
              done={data.classwork.completed}
              total={data.classwork.total}
              color="blue"
            />
            <StatCard
              label="Homework"
              done={data.homework.completed}
              total={data.homework.total}
              color="amber"
            />
            <StatCard
              label="Events — Action Taken"
              done={data.events.action_taken}
              total={data.events.total}
              color="green"
            />
            <StatCard
              label="Todos"
              done={data.todos.completed}
              total={data.todos.total}
              color="purple"
            />
          </div>

          {/* Detail rows */}
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {[
              { label: 'Classwork entries completed', done: data.classwork.completed, total: data.classwork.total },
              { label: 'Homework entries completed', done: data.homework.completed, total: data.homework.total },
              { label: 'Events actioned', done: data.events.action_taken, total: data.events.total },
              { label: 'Todos completed (all time)', done: data.todos.completed, total: data.todos.total },
            ].map(({ label: l, done, total }) => (
              <div key={l} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-600">{l}</span>
                <span className="text-sm font-semibold text-gray-800">
                  {done} / {total}
                </span>
              </div>
            ))}
          </div>

          {data.classwork.total === 0 && data.homework.total === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              No planner data for {period === 'week' ? 'this week' : 'this month'} yet.
            </p>
          )}
        </>
      ) : null}
    </div>
  )
}
