import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, CheckCircle, Circle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { todosApi } from '../../api'

const PRIORITY_STYLES = {
  HIGH: 'bg-red-100 text-red-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  due_date: '',
  priority: 'MEDIUM',
}

export default function TodosView() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const params = filter === 'active' ? { completed: false } : filter === 'done' ? { completed: true } : {}
  const { data: todos = [] } = useQuery({
    queryKey: ['todos', filter],
    queryFn: () => todosApi.list(params),
  })

  const createMutation = useMutation({
    mutationFn: (data) => todosApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] })
      setForm(EMPTY_FORM)
      setShowForm(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => todosApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => todosApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    const data = { ...form }
    if (!data.due_date) delete data.due_date
    createMutation.mutate(data)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Todos</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Todo
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[['all', 'All'], ['active', 'Active'], ['done', 'Done']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`text-sm px-3 py-1 rounded-md transition-colors ${
              filter === val ? 'bg-white shadow-sm font-medium text-gray-800' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border border-gray-200 p-4 space-y-3"
        >
          <h3 className="text-sm font-semibold text-gray-700">New Todo</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Task title *"
                required
              />
            </div>
            <div>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HIGH">High Priority</option>
                <option value="MEDIUM">Medium Priority</option>
                <option value="LOW">Low Priority</option>
              </select>
            </div>
            <div className="col-span-2">
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Description (optional)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>
        </form>
      )}

      {/* Todo list */}
      {todos.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No todos</p>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-start gap-3 bg-white rounded-lg border border-gray-200 px-3 py-3 group ${
                todo.is_completed ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => updateMutation.mutate({ id: todo.id, data: { is_completed: !todo.is_completed } })}
                className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors"
              >
                {todo.is_completed ? (
                  <CheckCircle size={18} className="text-green-500" />
                ) : (
                  <Circle size={18} />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium text-gray-800 ${todo.is_completed ? 'line-through' : ''}`}>
                  {todo.title}
                </p>
                {todo.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{todo.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${PRIORITY_STYLES[todo.priority]}`}>
                    {todo.priority}
                  </span>
                  {todo.due_date && (
                    <span className="text-xs text-gray-400">
                      Due {format(new Date(todo.due_date + 'T00:00:00'), 'MMM d')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(todo.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all flex-shrink-0 mt-0.5"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
