import { useState } from 'react'
import { Calendar, CheckSquare, Bell, Settings, BookOpen, Plus, LogOut, ChevronDown, CalendarDays, BarChart2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './hooks/useAuth'
import LoginPage from './components/Auth/LoginPage'
import CalendarView from './components/Calendar/CalendarView'
import DayPanel from './components/DayView/DayPanel'
import ParseModal from './components/MessageParser/ParseModal'
import TodosView from './components/Todos/TodosView'
import TestAlertsView from './components/TestAlerts/TestAlertsView'
import SettingsView from './components/Settings/SettingsView'
import EventsPanel from './components/Events/EventsPanel'
import SummaryView from './components/Summary/SummaryView'

const TABS = [
  { id: 'calendar', label: 'Calendar', Icon: Calendar },
  { id: 'events', label: 'Events', Icon: CalendarDays },
  { id: 'todos', label: 'Todos', Icon: CheckSquare },
  { id: 'tests', label: 'Test Alerts', Icon: Bell },
  { id: 'summary', label: 'Summary', Icon: BarChart2 },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

function ChildAvatar({ child, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-2 py-1 transition-colors"
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
        style={{ backgroundColor: child.color }}
      >
        {child.name[0].toUpperCase()}
      </div>
      <span className="text-sm font-medium text-gray-700 hidden sm:block">{child.name}</span>
      <ChevronDown size={14} className="text-gray-400" />
    </button>
  )
}

export default function App() {
  const { isAuthenticated, child, login, logout, updateChild } = useAuth()
  const [activeTab, setActiveTab] = useState('calendar')
  const [selectedDate, setSelectedDate] = useState(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isParseModalOpen, setIsParseModalOpen] = useState(false)
  const [showChildMenu, setShowChildMenu] = useState(false)
  const [highlightEventDate, setHighlightEventDate] = useState(null)
  const queryClient = useQueryClient()

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />
  }

  function handleDaySelect(dateStr) {
    setSelectedDate(dateStr)
    setIsPanelOpen(true)
  }

  function handleEventDotClick(dateStr) {
    setHighlightEventDate(dateStr)
    setActiveTab('events')
  }

  function handleParseDone(parsedDate) {
    queryClient.invalidateQueries({ queryKey: ['planner-range'] })
    queryClient.invalidateQueries({ queryKey: ['planner-day', parsedDate] })
    setIsParseModalOpen(false)
    if (parsedDate) {
      setSelectedDate(parsedDate)
      setActiveTab('calendar')
      setIsPanelOpen(true)
    }
  }

  function handleLogout() {
    logout()
    queryClient.clear()
    setShowChildMenu(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-500" size={22} />
            <span className="font-semibold text-gray-800 text-lg">School Planner</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsParseModalOpen(true)}
              className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Parse Message</span>
            </button>

            {/* Child switcher */}
            <div className="relative">
              <ChildAvatar child={child} onClick={() => setShowChildMenu(!showChildMenu)} />
              {showChildMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-36 z-50">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-800">{child.name}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={14} />
                    Switch Profile
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 flex gap-0">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setShowChildMenu(false) }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main
        className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex gap-4"
        onClick={() => setShowChildMenu(false)}
      >
        <div className="flex-1 min-w-0">
          {activeTab === 'calendar' && (
            <CalendarView onDaySelect={handleDaySelect} onEventDotClick={handleEventDotClick} selectedDate={selectedDate} />
          )}
          {activeTab === 'events' && (
            <EventsPanel highlightDate={highlightEventDate} onHighlightClear={() => setHighlightEventDate(null)} />
          )}
          {activeTab === 'todos' && <TodosView />}
          {activeTab === 'tests' && <TestAlertsView />}
          {activeTab === 'summary' && <SummaryView />}
          {activeTab === 'settings' && (
            <SettingsView child={child} onChildUpdate={updateChild} />
          )}
        </div>

        {isPanelOpen && activeTab === 'calendar' && (
          <DayPanel date={selectedDate} onClose={() => setIsPanelOpen(false)} />
        )}
      </main>

      {isParseModalOpen && (
        <ParseModal onClose={() => setIsParseModalOpen(false)} onDone={handleParseDone} />
      )}
    </div>
  )
}
