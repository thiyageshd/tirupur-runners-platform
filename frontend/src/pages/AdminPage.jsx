import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Users, TrendingUp, XCircle, Clock, Loader2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { adminApi } from '../api'
import { format } from 'date-fns'

const STATUS_BADGE = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!user.is_admin) { navigate('/dashboard'); return }
    loadData()
  }, [user, filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [membersRes, statsRes] = await Promise.all([
        adminApi.getMembers(filter || undefined),
        adminApi.getStats(),
      ])
      setMembers(membersRes.data)
      setStats(statsRes.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await adminApi.exportCsv(filter || undefined)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `members_${filter || 'all'}_${Date.now()}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch { }
    setExporting(false)
  }

  const filtered = members.filter((m) =>
    !search ||
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.phone.includes(search)
  )

  const STAT_CARDS = stats
    ? [
        { label: 'Total Members', value: stats.total_members, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Active', value: stats.active_members, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Expired', value: stats.expired_members, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
        {
          label: 'Total Revenue',
          value: `₹${((stats.total_revenue_paise || 0) / 100).toLocaleString('en-IN')}`,
          icon: Clock,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : []

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-3xl text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-1">Tirupur Runners Club — Member Management</p>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="btn-outline flex items-center gap-2"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export CSV
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon size={18} className={color} />
                </div>
                <div>
                  <p className="font-bold text-xl text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters + search */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          <div className="flex rounded-xl bg-white border border-gray-200 overflow-hidden">
            {['', 'active', 'expired', 'pending'].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  filter === s ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="text"
            className="input-field max-w-xs"
            placeholder="Search name / email / phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <span className="text-sm text-gray-400 ml-auto">{filtered.length} members</span>
        </div>

        {/* Table */}
        <div className="card overflow-x-auto p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={28} className="animate-spin text-brand-600" />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Name', 'Email', 'Phone', 'Age', 'Gender', 'Status', 'Year', 'Valid Until', 'Joined'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">No members found</td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={`${m.user_id}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{m.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{m.email}</td>
                      <td className="px-4 py-3 text-gray-600">{m.phone}</td>
                      <td className="px-4 py-3 text-gray-600">{m.age}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{m.gender}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[m.membership_status]}`}>
                          {m.membership_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{m.membership_year}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {m.end_date ? format(new Date(m.end_date), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {m.created_at ? format(new Date(m.created_at), 'dd MMM yyyy') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
