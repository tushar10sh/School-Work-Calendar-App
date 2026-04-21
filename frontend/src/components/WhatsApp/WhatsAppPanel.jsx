import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Wifi, WifiOff, RefreshCw, Link, Unlink, Loader2, CheckCircle, QrCode, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { whatsappApi, syncApi } from '../../api'

const STATUS_COLORS = {
  CONNECTED: 'text-green-600 bg-green-50',
  QR_PENDING: 'text-amber-600 bg-amber-50',
  LOADING: 'text-blue-600 bg-blue-50',
  DISCONNECTED: 'text-gray-500 bg-gray-100',
  UNREACHABLE: 'text-red-500 bg-red-50',
}

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[status] || STATUS_COLORS.DISCONNECTED}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'CONNECTED' ? 'bg-green-500 animate-pulse' : 'bg-current'}`} />
      {status}
    </span>
  )
}

export default function WhatsAppPanel({ child, onChildUpdate }) {
  const queryClient = useQueryClient()
  const [selectedGroup, setSelectedGroup] = useState(null)

  const { data: waStatus } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: () => whatsappApi.getStatus(),
    refetchInterval: (query) => {
      const s = query.state.data?.status
      return s === 'QR_PENDING' || s === 'LOADING' ? 2000 : 30000
    },
  })

  const { data: qrData } = useQuery({
    queryKey: ['whatsapp-qr'],
    queryFn: () => whatsappApi.getQR(),
    enabled: waStatus?.status === 'QR_PENDING',
    refetchInterval: 3000,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: () => whatsappApi.getGroups(),
    enabled: waStatus?.status === 'CONNECTED',
  })

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => syncApi.status(),
    refetchInterval: 30000,
  })

  const reconnectMutation = useMutation({
    mutationFn: () => whatsappApi.reconnect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] }),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => whatsappApi.disconnect(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] }),
  })

  const connectGroupMutation = useMutation({
    mutationFn: ({ group_id, group_name }) => whatsappApi.connectGroup(group_id, group_name),
    onSuccess: (_, vars) => {
      onChildUpdate({ ...child, whatsapp_group_id: vars.group_id, whatsapp_group_name: vars.group_name })
      setSelectedGroup(null)
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
    },
  })

  const updateChildMutation = useMutation({
    mutationFn: (data) => import('../../api').then(m => m.childrenApi.update(child.id, data)),
    onSuccess: (updated) => onChildUpdate(updated),
  })

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['planner-range'] })
    },
  })

  const status = waStatus?.status || 'UNREACHABLE'
  const isConnected = status === 'CONNECTED'
  const isQRPending = status === 'QR_PENDING'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">WhatsApp Connection</h3>
        <StatusBadge status={status} />
      </div>

      {/* Connected phone */}
      {isConnected && waStatus?.phone && (
        <p className="text-xs text-gray-500">
          Connected as <span className="font-medium text-gray-700">+{waStatus.phone}</span>
        </p>
      )}

      {/* QR Code */}
      {isQRPending && (
        <div className="flex flex-col items-center gap-3 py-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
            <QrCode size={16} />
            Scan with WhatsApp to connect
          </div>
          {qrData?.qr ? (
            <img src={qrData.qr} alt="WhatsApp QR Code" className="w-48 h-48 rounded" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-white rounded border">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          )}
          <p className="text-xs text-amber-600 text-center px-4">
            Open WhatsApp → Settings → Linked Devices → Link a Device
          </p>
        </div>
      )}

      {/* Loading */}
      {status === 'LOADING' && (
        <div className="flex items-center gap-2 text-sm text-blue-600 py-2">
          <Loader2 size={16} className="animate-spin" />
          Connecting to WhatsApp…
        </div>
      )}

      {/* Connect / Reconnect / Disconnect buttons */}
      <div className="flex gap-2 flex-wrap">
        {!isConnected && status !== 'LOADING' && (
          <button
            onClick={() => reconnectMutation.mutate()}
            disabled={reconnectMutation.isPending}
            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {reconnectMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Wifi size={14} />
            )}
            {status === 'DISCONNECTED' || status === 'UNREACHABLE' ? 'Connect' : 'Reconnect'}
          </button>
        )}
        {isConnected && (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <WifiOff size={14} />
            Disconnect
          </button>
        )}
      </div>

      {/* Group selector */}
      {isConnected && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">
            {child.whatsapp_group_name ? (
              <span className="flex items-center gap-1">
                <CheckCircle size={13} className="text-green-500" />
                Syncing from: <strong>{child.whatsapp_group_name}</strong>
              </span>
            ) : (
              'Select WhatsApp group to sync from:'
            )}
          </p>
          {groups.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(selectedGroup?.id === g.id ? null : g)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                    selectedGroup?.id === g.id || child.whatsapp_group_id === g.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{g.participantCount} members</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No groups found</p>
          )}

          {selectedGroup && selectedGroup.id !== child.whatsapp_group_id && (
            <button
              onClick={() => connectGroupMutation.mutate({ group_id: selectedGroup.id, group_name: selectedGroup.name })}
              disabled={connectGroupMutation.isPending}
              className="mt-2 flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Link size={13} />
              Use "{selectedGroup.name}"
            </button>
          )}
        </div>
      )}

      {/* Sync controls */}
      {child.whatsapp_group_id && (
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-600">Manual Sync</p>
            {syncStatus?.last_synced_at && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <Clock size={11} />
                Last synced {formatDistanceToNow(
                  new Date(syncStatus.last_synced_at.endsWith('Z') ? syncStatus.last_synced_at : syncStatus.last_synced_at + 'Z'),
                  { addSuffix: true }
                )}
              </p>
            )}
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !isConnected}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {syncMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Sync Now
          </button>
        </div>
      )}

      {/* Parse events toggle */}
      {child.whatsapp_group_id && (
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-gray-600">Auto-detect Events</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Parse non-planner messages for school events &amp; parent activities
            </p>
          </div>
          <button
            onClick={() => updateChildMutation.mutate({ parse_events: !child.parse_events })}
            disabled={updateChildMutation.isPending}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              child.parse_events ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                child.parse_events ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      )}

      {syncMutation.data && (
        <div className="text-xs bg-green-50 text-green-700 rounded-lg px-3 py-2 border border-green-200">
          Sync complete — {syncMutation.data.parsed} message(s) parsed
          {syncMutation.data.events_added > 0 && `, ${syncMutation.data.events_added} event(s) added`}
        </div>
      )}
    </div>
  )
}
