import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_CONFIG = {
  active: {
    icon: CheckCircle,
    label: 'Active Member',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
  },
  expired: {
    icon: XCircle,
    label: 'Membership Expired',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
  },
  pending: {
    icon: Clock,
    label: 'Payment Pending',
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
  },
}

export default function MembershipBadge({ membership }) {
  if (!membership) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200">
        <AlertCircle size={16} className="text-gray-400" />
        <span className="text-sm text-gray-500">No membership found</span>
      </div>
    )
  }

  const config = STATUS_CONFIG[membership.status] || STATUS_CONFIG.pending
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${config.bg} ${config.border}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
      <Icon size={16} className={config.text} />
      <div className="flex-1">
        <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
        {membership.end_date && (
          <p className="text-xs text-gray-500">
            Valid until {format(new Date(membership.end_date), 'dd MMM yyyy')}
          </p>
        )}
      </div>
    </div>
  )
}
