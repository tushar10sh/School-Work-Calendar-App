import { useState, useMemo, useCallback } from 'react'
import { Calendar, momentLocalizer } from 'react-big-calendar'
import moment from 'moment'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns'
import { plannerApi } from '../../api'

const localizer = momentLocalizer(moment)

function formatRange(date) {
  const d = date ? new Date(date) : new Date()
  return {
    start: format(startOfMonth(d), 'yyyy-MM-dd'),
    end: format(endOfMonth(d), 'yyyy-MM-dd'),
  }
}

export default function CalendarView({ onDaySelect, onEventDotClick, selectedDate }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const range = useMemo(() => formatRange(currentDate), [currentDate])

  const { data: rangeData = {} } = useQuery({
    queryKey: ['planner-range', range.start, range.end],
    queryFn: () => plannerApi.getRange(range.start, range.end),
    staleTime: 1000 * 60,
  })

  const events = useMemo(() => {
    const evts = []
    for (const [dateStr, info] of Object.entries(rangeData)) {
      const d = new Date(dateStr + 'T00:00:00')
      if (info.has_cw) evts.push({ title: 'CW', start: d, end: d, resource: 'cw' })
      if (info.has_pw) evts.push({ title: 'PW', start: d, end: d, resource: 'pw' })
      if (info.has_events) evts.push({ title: 'Event', start: d, end: d, resource: 'event' })
      if (info.has_tests) evts.push({ title: 'Test', start: d, end: d, resource: 'test' })
    }
    return evts
  }, [rangeData])

  const eventPropGetter = useCallback((event) => {
    const classMap = {
      cw: 'cw-event',
      pw: 'pw-event',
      event: 'event-event',
      test: 'test-event',
    }
    return { className: classMap[event.resource] || '' }
  }, [])

  const dayPropGetter = useCallback(
    (date) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      if (dateStr === selectedDate) {
        return { className: 'rbc-day-selected' }
      }
      return {}
    },
    [selectedDate]
  )

  function handleNavigate(newDate) {
    setCurrentDate(newDate)
  }

  function handleSelectSlot({ start }) {
    onDaySelect(format(start, 'yyyy-MM-dd'))
  }

  function handleSelectEvent(event) {
    const dateStr = format(event.start, 'yyyy-MM-dd')
    if (event.resource === 'event' && onEventDotClick) {
      onEventDotClick(dateStr)
    } else {
      onDaySelect(dateStr)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3 text-xs text-gray-600">
        {[
          { color: 'bg-blue-500', label: 'Classwork' },
          { color: 'bg-amber-500', label: 'Homework' },
          { color: 'bg-green-500', label: 'Event' },
          { color: 'bg-red-500', label: 'Test' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${color}`} />
            {label}
          </div>
        ))}
      </div>
      <Calendar
        localizer={localizer}
        events={events}
        defaultView="month"
        views={['month', 'week', 'agenda']}
        date={currentDate}
        onNavigate={handleNavigate}
        selectable
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        eventPropGetter={eventPropGetter}
        dayPropGetter={dayPropGetter}
        popup
        style={{ height: 'calc(100vh - 200px)' }}
      />
      <style>{`
        .rbc-day-selected { background-color: #eff6ff !important; }
      `}</style>
    </div>
  )
}
