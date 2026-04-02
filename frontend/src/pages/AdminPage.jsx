import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download, Users, TrendingUp, XCircle, Clock, Loader2,
  Crown, Shield, ShieldOff, Upload, MessageSquare, Settings, CheckCircle2,
  Pencil, Check, X, UserCheck, UserX, FileText,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { adminApi, settingsApi } from '../api'
import { format } from 'date-fns'

const STATUS_BADGE = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
}

const TABS = ['Members', 'Approvals', 'Rejected', 'Inactive Members', 'Offline Payments', 'SMS', 'Settings']

// Emails that can never be deleted via the admin panel
const PROTECTED_ADMINS = ['thiyagesh.d@gmail.com']

const SMS_TEMPLATES = {
  'Renewal Reminder': 'Hi {name}, your Tirupur Runners membership expires soon. Renew at https://tirupurrunners.in',
  'New Member Welcome': 'Welcome to Tirupur Runners, {name}! Lace up and join us every Sunday 5:30 AM at Tirupur Collectorate.',
  'Event Reminder': "Don't miss our upcoming run! See you Sunday at Tirupur Collectorate, 5:30 AM. — Tirupur Runners",
}

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('Members')

  // Members tab
  const [members, setMembers] = useState([])
  const [stats, setStats] = useState(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [togglingAdmin, setTogglingAdmin] = useState(null)

  // T-shirt inline editing
  const [editingTshirt, setEditingTshirt] = useState(null)
  const [tshirtEditValue, setTshirtEditValue] = useState('')
  const [savingTshirt, setSavingTshirt] = useState(null)

  // Membership ID inline editing
  const [editingMembershipId, setEditingMembershipId] = useState(null)
  const [membershipIdValue, setMembershipIdValue] = useState('')
  const [savingMembershipId, setSavingMembershipId] = useState(null)

  // Approvals tab
  const [pendingUsers, setPendingUsers] = useState([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [inactiveMembers, setInactiveMembers] = useState([])
  const [inactiveLoading, setInactiveLoading] = useState(false)
  const [approvingUser, setApprovingUser] = useState(null)
  const [rejectingUser, setRejectingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [deleteToast, setDeleteToast] = useState(false)

  // Rejected tab
  const [rejectedUsers, setRejectedUsers] = useState([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [reapprovingUser, setReapprovingUser] = useState(null)

  // Aadhar replace (admin)
  const aadharReplaceInputRef = useRef(null)
  const [replacingAadharFor, setReplacingAadharFor] = useState(null) // { userId, listType: 'pending'|'members' }
  const [aadharReplaceLoading, setAadharReplaceLoading] = useState(null) // userId

  // Offline payments tab
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const fileInputRef = useRef(null)

  // SMS tab
  const [smsRecipient, setSmsRecipient] = useState('All')
  const [smsTemplate, setSmsTemplate] = useState('Renewal Reminder')
  const [smsMessage, setSmsMessage] = useState(SMS_TEMPLATES['Renewal Reminder'])
  const [smsToast, setSmsToast] = useState(false)

  // Settings tab
  const [siteSettings, setSiteSettings] = useState(null)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/members/login'); return }
    if (!user.is_admin) { navigate('/members/dashboard'); return }
    loadData()
    loadSettings()
  }, [user])

  useEffect(() => {
    if (activeTab === 'Members') loadData()
  }, [filter])

  useEffect(() => {
    if (activeTab === 'Approvals') loadPendingUsers()
    if (activeTab === 'Rejected') loadRejectedUsers()
    if (activeTab === 'Inactive Members') loadInactiveMembers()
  }, [activeTab])

  const loadInactiveMembers = async () => {
    setInactiveLoading(true)
    try {
      const res = await adminApi.getInactiveMembers()
      setInactiveMembers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setInactiveLoading(false)
    }
  }

  const loadRejectedUsers = async () => {
    setRejectedLoading(true)
    try {
      const res = await adminApi.getRejectedUsers()
      setRejectedUsers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setRejectedLoading(false)
    }
  }

  const handleReapprove = async (userId) => {
    if (!confirm('Re-approve this user? They will receive an approval email and can log in.')) return
    setReapprovingUser(userId)
    try {
      await adminApi.approveUser(userId)
      setRejectedUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve')
    } finally {
      setReapprovingUser(null)
    }
  }

  const handleDeleteRejected = async (userId) => {
    if (!PROTECTED_ADMINS.includes(user?.email?.toLowerCase())) return
    if (!confirm('Permanently delete this rejected user? This cannot be undone.')) return
    setDeletingUser(userId)
    try {
      await adminApi.deleteUser(userId)
      setRejectedUsers((prev) => prev.filter((u) => u.id !== userId))
      setDeleteToast(true)
      setTimeout(() => setDeleteToast(false), 3000)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeletingUser(null)
    }
  }

  const loadPendingUsers = async () => {
    setPendingLoading(true)
    try {
      const res = await adminApi.getPendingUsers()
      setPendingUsers(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setPendingLoading(false)
    }
  }

  const handleApprove = async (userId) => {
    setApprovingUser(userId)
    try {
      await adminApi.approveUser(userId)
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to approve')
    } finally {
      setApprovingUser(null)
    }
  }

  const handleReject = async (userId) => {
    if (!confirm('Reject this registration?')) return
    setRejectingUser(userId)
    try {
      await adminApi.rejectUser(userId)
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId))
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject')
    } finally {
      setRejectingUser(null)
    }
  }

  const handleSaveMembershipId = async (membershipUuid) => {
    if (!membershipIdValue.trim()) return
    setSavingMembershipId(membershipUuid)
    try {
      await adminApi.updateMembershipId(membershipUuid, membershipIdValue.trim())
      setMembers((prev) =>
        prev.map((m) => m.membership_uuid === membershipUuid ? { ...m, membership_id: membershipIdValue.trim() } : m)
      )
      setEditingMembershipId(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update membership ID')
    } finally {
      setSavingMembershipId(null)
    }
  }

  const openAadhar = (aadharUrl, name) => {
    // Convert base64 data URI to blob URL so the browser can display it
    try {
      const arr = aadharUrl.split(',')
      const mime = arr[0].match(/:(.*?);/)[1]
      const bstr = atob(arr[1])
      const u8arr = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
      const blob = new Blob([u8arr], { type: mime })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      window.open(aadharUrl, '_blank')
    }
  }

  const triggerAadharReplace = (userId, listType) => {
    setReplacingAadharFor({ userId, listType })
    aadharReplaceInputRef.current?.click()
  }

  const handleAadharFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file || !replacingAadharFor) return
    if (file.size > 2097152) { alert('File must be under 2MB'); return }
    const reader = new FileReader()
    const { userId, listType } = replacingAadharFor
    reader.onload = async (ev) => {
      setAadharReplaceLoading(userId)
      try {
        await adminApi.replaceAadhar(userId, ev.target.result)
        // Update local state
        if (listType === 'pending') {
          setPendingUsers((prev) => prev.map((u) => u.id === userId ? { ...u, aadhar_url: ev.target.result } : u))
        } else {
          setMembers((prev) => prev.map((m) => m.user_id === userId ? { ...m, aadhar_url: ev.target.result } : m))
        }
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to replace Aadhar')
      } finally {
        setAadharReplaceLoading(null)
        setReplacingAadharFor(null)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const handleDelete = async (userId) => {
    if (!PROTECTED_ADMINS.includes(user?.email?.toLowerCase())) return
    if (!confirm('Delete this pending registration? This cannot be undone.')) return
    setDeletingUser(userId)
    try {
      await adminApi.deleteUser(userId)
      setPendingUsers((prev) => prev.filter((u) => u.id !== userId))
      setDeleteToast(true)
      setTimeout(() => setDeleteToast(false), 3000)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete')
    } finally {
      setDeletingUser(null)
    }
  }

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

  const loadSettings = async () => {
    try {
      const res = await settingsApi.get()
      setSiteSettings(res.data)
    } catch {}
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
    } catch {}
    setExporting(false)
  }

  const handleToggleAdmin = async (member) => {
    const action = member.is_admin ? 'Remove admin from' : 'Make admin'
    if (!confirm(`${action} ${member.full_name}?`)) return
    setTogglingAdmin(member.user_id)
    try {
      await adminApi.toggleAdmin(member.user_id)
      await loadData()
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle admin')
    } finally {
      setTogglingAdmin(null)
    }
  }

  const handleSaveTshirt = async (userId) => {
    if (!tshirtEditValue) return
    setSavingTshirt(userId)
    try {
      await adminApi.updateTshirt(userId, tshirtEditValue)
      setMembers((prev) =>
        prev.map((m) => m.user_id === userId ? { ...m, t_shirt_size: tshirtEditValue } : m)
      )
      setEditingTshirt(null)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update T-shirt size')
    } finally {
      setSavingTshirt(null)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      const res = await adminApi.uploadOfflinePayments(formData)
      setUploadResult(res.data)
    } catch (err) {
      setUploadResult({ error: err.response?.data?.detail || 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  const handleSmsTemplateChange = (template) => {
    setSmsTemplate(template)
    setSmsMessage(SMS_TEMPLATES[template])
  }

  const handleSendSms = () => {
    setSmsToast(true)
    setTimeout(() => setSmsToast(false), 3000)
  }

  const handleSaveSettings = async () => {
    if (!siteSettings) return
    setSettingsSaving(true)
    try {
      await settingsApi.update(siteSettings)
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2500)
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save settings')
    } finally {
      setSettingsSaving(false)
    }
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
        { label: 'Pending', value: stats.pending_members, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        {
          label: 'Total Revenue',
          value: `₹${((stats.total_revenue_paise || 0) / 100).toLocaleString('en-IN')}`,
          icon: Clock,
          color: 'text-purple-600',
          bg: 'bg-purple-50',
        },
      ]
    : []

  const smsRecipientCount = smsRecipient === 'All'
    ? stats?.total_members
    : smsRecipient === 'Active'
    ? stats?.active_members
    : smsRecipient === 'Expired'
    ? stats?.expired_members
    : null

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 bg-gray-50">
      {/* Hidden file input shared across all Aadhar replace actions */}
      <input
        ref={aadharReplaceInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleAadharFileChange}
      />
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-3xl text-gray-900">Admin Panel</h1>
            <p className="text-gray-500 text-sm mt-1">Tirupur Runners Club — Management</p>
          </div>
          {activeTab === 'Members' && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-outline flex items-center gap-2"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Export CSV
            </button>
          )}
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {deleteToast && (
          <div className="mb-4 bg-green-50 border border-green-100 text-green-700 text-sm rounded-xl px-4 py-3 text-center font-medium">
            ✅ Pending registration deleted
          </div>
        )}

        {/* ── Members Tab ── */}
        {activeTab === 'Members' && (
          <>
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

            <div className="card overflow-x-auto p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={28} className="animate-spin text-brand-600" />
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      {['Name', 'Email', 'Phone', 'Age', 'Gender', 'T-Shirt', 'Member ID', 'Aadhar', 'Status', 'Year', 'Valid Until', 'Joined', 'Admin'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="text-center py-12 text-gray-400">No members found</td>
                      </tr>
                    ) : (
                      filtered.map((m) => (
                        <tr key={`${m.user_id}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {m.is_admin && <Crown size={12} className="text-amber-500" />}
                              {m.full_name}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{m.email}</td>
                          <td className="px-4 py-3 text-gray-600">{m.phone}</td>
                          <td className="px-4 py-3 text-gray-600">{m.age}</td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{m.gender}</td>
                          <td className="px-4 py-3">
                            {editingTshirt === m.user_id ? (
                              <span className="flex items-center gap-1">
                                <select
                                  value={tshirtEditValue}
                                  onChange={(e) => setTshirtEditValue(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-1.5 py-1"
                                >
                                  <option value="">—</option>
                                  {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleSaveTshirt(m.user_id)}
                                  disabled={!tshirtEditValue || savingTshirt === m.user_id}
                                  className="text-green-600 hover:bg-green-50 p-1 rounded disabled:opacity-40"
                                >
                                  {savingTshirt === m.user_id
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <Check size={12} />}
                                </button>
                                <button
                                  onClick={() => setEditingTshirt(null)}
                                  className="text-gray-400 hover:bg-gray-100 p-1 rounded"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <span className="text-gray-600">{m.t_shirt_size || '—'}</span>
                                <button
                                  onClick={() => { setEditingTshirt(m.user_id); setTshirtEditValue(m.t_shirt_size || '') }}
                                  className="text-gray-300 hover:text-brand-600 p-0.5 rounded"
                                  title="Edit T-shirt size"
                                >
                                  <Pencil size={11} />
                                </button>
                              </span>
                            )}
                          </td>
                          {/* Member ID */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {editingMembershipId === m.membership_uuid ? (
                              <span className="flex items-center gap-1">
                                <input
                                  value={membershipIdValue}
                                  onChange={(e) => setMembershipIdValue(e.target.value)}
                                  className="text-xs border border-gray-300 rounded px-1.5 py-1 w-28"
                                  placeholder="e.g. 202603TR01"
                                />
                                <button
                                  onClick={() => handleSaveMembershipId(m.membership_uuid)}
                                  disabled={!membershipIdValue.trim() || savingMembershipId === m.membership_uuid}
                                  className="text-green-600 hover:bg-green-50 p-1 rounded disabled:opacity-40"
                                >
                                  {savingMembershipId === m.membership_uuid
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : <Check size={12} />}
                                </button>
                                <button onClick={() => setEditingMembershipId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded">
                                  <X size={12} />
                                </button>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <span className="text-xs font-mono text-gray-700">{m.membership_id || '—'}</span>
                                <button
                                  onClick={() => { setEditingMembershipId(m.membership_uuid); setMembershipIdValue(m.membership_id || '') }}
                                  className="text-gray-300 hover:text-brand-600 p-0.5 rounded"
                                  title="Edit member ID"
                                >
                                  <Pencil size={11} />
                                </button>
                              </span>
                            )}
                          </td>
                          {/* Aadhar */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {m.aadhar_url ? (
                              <span className="flex items-center gap-1.5">
                                <button
                                  onClick={() => openAadhar(m.aadhar_url, m.full_name)}
                                  className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                                >
                                  <FileText size={12} /> View
                                </button>
                                <button
                                  onClick={() => triggerAadharReplace(m.user_id, 'members')}
                                  disabled={aadharReplaceLoading === m.user_id}
                                  className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-0.5 disabled:opacity-50"
                                  title="Replace Aadhar"
                                >
                                  {aadharReplaceLoading === m.user_id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                                </button>
                              </span>
                            ) : (
                              <button
                                onClick={() => triggerAadharReplace(m.user_id, 'members')}
                                disabled={aadharReplaceLoading === m.user_id}
                                className="text-xs text-gray-400 hover:text-brand-600 flex items-center gap-1 disabled:opacity-50"
                              >
                                {aadharReplaceLoading === m.user_id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                              </button>
                            )}
                          </td>
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
                          <td className="px-4 py-3">
                            {m.user_id !== user?.id && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleAdmin(m)}
                                  disabled={togglingAdmin === m.user_id}
                                  title={m.is_admin ? 'Remove admin' : 'Make admin'}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    m.is_admin
                                      ? 'text-amber-500 hover:bg-amber-50'
                                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                                  }`}
                                >
                                  {togglingAdmin === m.user_id
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : m.is_admin
                                    ? <ShieldOff size={14} />
                                    : <Shield size={14} />}
                                </button>
                                {m.account_status === 'approved' && m.membership_status === 'pending' && PROTECTED_ADMINS.includes(user?.email?.toLowerCase()) && (
                                  <button
                                    onClick={() => handleDelete(m.user_id)}
                                    disabled={deletingUser === m.user_id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                                  >
                                    {deletingUser === m.user_id
                                      ? <Loader2 size={12} className="animate-spin" />
                                      : <X size={12} />}
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ── Approvals Tab ── */}
        {activeTab === 'Approvals' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <UserCheck size={18} className="text-amber-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Pending Registrations</h2>
                <p className="text-xs text-gray-500">Approve or reject new member registrations</p>
              </div>
            </div>

            {pendingLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-brand-600" />
              </div>
            ) : pendingUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <UserCheck size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No pending registrations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email} · {u.phone}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Age {u.age} · {u.gender}
                          {u.t_shirt_size && ` · ${u.t_shirt_size}`}
                          {u.created_at && ` · Registered ${format(new Date(u.created_at), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(u.id)}
                          disabled={approvingUser === u.id || rejectingUser === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {approvingUser === u.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <UserCheck size={12} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(u.id)}
                          disabled={approvingUser === u.id || rejectingUser === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {rejectingUser === u.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <UserX size={12} />}
                          Reject
                        </button>
                      </div>
                    </div>

                    {/* Aadhar preview / status */}
                    {u.aadhar_url ? (
                      <div className="flex items-center gap-3 mt-1">
                        {u.aadhar_url.startsWith('data:image/') ? (
                          <img
                            src={u.aadhar_url}
                            alt="Aadhar"
                            className="h-16 w-24 object-cover rounded-lg border border-gray-200 bg-gray-100 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => openAadhar(u.aadhar_url, u.full_name)}
                          />
                        ) : (
                          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                            <FileText size={16} className="text-blue-600" />
                            <span className="text-xs text-blue-700 font-medium">PDF</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAadhar(u.aadhar_url, u.full_name)}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                          >
                            <FileText size={12} /> View
                          </button>
                          <button
                            onClick={() => triggerAadharReplace(u.id, 'pending')}
                            disabled={aadharReplaceLoading === u.id}
                            className="text-xs text-gray-500 hover:text-brand-600 font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            {aadharReplaceLoading === u.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Replace
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          ⚠ No Aadhar uploaded
                        </span>
                        <button
                          onClick={() => triggerAadharReplace(u.id, 'pending')}
                          disabled={aadharReplaceLoading === u.id}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 disabled:opacity-50"
                        >
                          {aadharReplaceLoading === u.id ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />} Upload
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* deleteToast moved to top-level so it shows across tabs */}
          </div>
        )}

        {/* ── Rejected Tab ── */}
        {activeTab === 'Rejected' && (
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                <UserX size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Rejected Registrations</h2>
                <p className="text-xs text-gray-500">Re-approve if a user comes back with a valid request</p>
              </div>
            </div>

            {rejectedLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-brand-600" />
              </div>
            ) : rejectedUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <UserX size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No rejected registrations</p>
              </div>
            ) : (
              <div className="space-y-4">
                {rejectedUsers.map((u) => (
                  <div key={u.id} className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email} · {u.phone}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Age {u.age} · {u.gender}
                          {u.t_shirt_size && ` · ${u.t_shirt_size}`}
                          {u.created_at && ` · Registered ${format(new Date(u.created_at), 'dd MMM yyyy')}`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleReapprove(u.id)}
                          disabled={reapprovingUser === u.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                          {reapprovingUser === u.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <UserCheck size={12} />}
                          Approve
                        </button>
                        {PROTECTED_ADMINS.includes(user?.email?.toLowerCase()) && (
                          <button
                            onClick={() => handleDeleteRejected(u.id)}
                            disabled={deletingUser === u.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                          >
                            {deletingUser === u.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <X size={12} />}
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {u.aadhar_url && (
                      <div className="mt-3">
                        <button
                          onClick={() => openAadhar(u.aadhar_url, u.full_name)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        >
                          <FileText size={12} /> View Aadhar
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Inactive Members Tab ── */}
        {activeTab === 'Inactive Members' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Inactive Members</h3>
                <p className="text-xs text-gray-500 mt-0.5">Members who did not renew by 31 Aug of their membership year</p>
              </div>
              <span className="text-sm text-gray-500">{inactiveMembers.length} member{inactiveMembers.length !== 1 ? 's' : ''}</span>
            </div>
            {inactiveLoading ? (
              <div className="text-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mx-auto" /></div>
            ) : inactiveMembers.length === 0 ? (
              <p className="text-center text-gray-400 py-12 text-sm">No inactive members</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4">Email</th>
                      <th className="pb-3 pr-4">Phone</th>
                      <th className="pb-3 pr-4">Last Membership Year</th>
                      <th className="pb-3">Inactive Since</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {inactiveMembers.map((m) => (
                      <tr key={m.user_id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{m.full_name}</td>
                        <td className="py-3 pr-4 text-gray-600">{m.email}</td>
                        <td className="py-3 pr-4 text-gray-600">{m.phone}</td>
                        <td className="py-3 pr-4 text-gray-600">{m.year}</td>
                        <td className="py-3 text-gray-600">{m.end_date ? format(new Date(m.end_date), 'dd MMM yyyy') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Offline Payments Tab ── */}
        {activeTab === 'Offline Payments' && (
          <div className="card max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Upload size={18} className="text-blue-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Upload Offline Payments</h2>
                <p className="text-xs text-gray-500">CSV / XLS / XLSX · Columns: name, mobile, email, year, amount (₹)</p>
              </div>
            </div>

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 transition-colors mb-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={24} className="mx-auto text-gray-400 mb-2" />
              {uploadFile
                ? <p className="text-sm font-medium text-gray-700">{uploadFile.name}</p>
                : <p className="text-sm text-gray-400">Click to select a CSV / XLS / XLSX file</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => { setUploadFile(e.target.files[0] || null); setUploadResult(null) }}
              />
            </div>

            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="btn-primary w-full flex items-center justify-center gap-2 mb-6"
            >
              {uploading
                ? <><Loader2 size={15} className="animate-spin" /> Uploading…</>
                : <><Upload size={15} /> Upload & Process</>}
            </button>

            {uploadResult && !uploadResult.error && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-green-50 rounded-xl p-3 text-center">
                    <p className="font-bold text-lg text-green-700">{uploadResult.processed}</p>
                    <p className="text-xs text-green-600">Processed</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3 text-center">
                    <p className="font-bold text-lg text-amber-700">{uploadResult.skipped}</p>
                    <p className="text-xs text-amber-600">Skipped</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="font-bold text-lg text-gray-700">{uploadResult.errors?.length || 0}</p>
                    <p className="text-xs text-gray-500">Issues</p>
                  </div>
                </div>
                {uploadResult.errors?.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4 max-h-48 overflow-y-auto">
                    <p className="text-xs font-semibold text-red-700 mb-2">Issues ({uploadResult.errors.length})</p>
                    {uploadResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-red-600 py-0.5">
                        Row {e.row}: {e.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {uploadResult?.error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{uploadResult.error}</p>
            )}
          </div>
        )}

        {/* ── SMS Tab ── */}
        {activeTab === 'SMS' && (
          <div className="card max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                <MessageSquare size={18} className="text-purple-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Bulk SMS</h2>
                <p className="text-xs text-gray-500">Send messages to club members</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Recipients</label>
                <select
                  className="input-field"
                  value={smsRecipient}
                  onChange={(e) => setSmsRecipient(e.target.value)}
                >
                  {['All', 'Active', 'Expired', 'Pending'].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                {smsRecipientCount != null && (
                  <p className="text-xs text-gray-400 mt-1">{smsRecipientCount} members selected</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Template</label>
                <select
                  className="input-field"
                  value={smsTemplate}
                  onChange={(e) => handleSmsTemplateChange(e.target.value)}
                >
                  {Object.keys(SMS_TEMPLATES).map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Message</label>
                <textarea
                  className="input-field resize-none"
                  rows={4}
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">{smsMessage.length} characters · Use {'{name}'} for personalization</p>
              </div>

              <button onClick={handleSendSms} className="btn-primary w-full">
                Send SMS
              </button>
            </div>

            {smsToast && (
              <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3 text-center font-medium">
                📱 SMS feature coming soon — integration in progress!
              </div>
            )}
          </div>
        )}

        {/* ── Settings Tab ── */}
        {activeTab === 'Settings' && (
          <div className="card max-w-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Settings size={18} className="text-gray-600" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">Site Settings</h2>
                <p className="text-xs text-gray-500">Contact info shown on the Contact page</p>
              </div>
            </div>

            {!siteSettings ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-brand-600" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Visibility toggles */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Member Portal Visibility</p>
                  <div className="bg-gray-50 rounded-xl divide-y divide-gray-100">
                    {[
                      { key: 'show_login',     label: 'Login button',    desc: 'Show Login button on /members pages' },
                      { key: 'show_register',  label: 'Register button', desc: 'Show Register button on /members pages' },
                      { key: 'show_join_club', label: '"Join the Club"', desc: 'Show Join buttons on Home & Events pages' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                        <button
                          onClick={() => setSiteSettings({ ...siteSettings, [key]: siteSettings[key] === 'false' ? 'true' : 'false' })}
                          className={`relative w-11 h-6 rounded-full transition-colors ${siteSettings[key] !== 'false' ? 'bg-brand-600' : 'bg-gray-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${siteSettings[key] !== 'false' ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact & club info */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Contact & Club Info</p>
                  {[
                    { key: 'contact_email', label: 'Contact Email', type: 'email' },
                    { key: 'contact_phone', label: 'Contact Phone', type: 'tel' },
                    { key: 'run_location', label: 'Run Location', type: 'text' },
                    { key: 'run_day_time', label: 'Run Day & Time', type: 'text' },
                    { key: 'maps_link', label: 'Google Maps Link', type: 'url' },
                  ].map(({ key, label, type }) => (
                    <div key={key} className="mb-3">
                      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
                      <input
                        type={type}
                        className="input-field"
                        value={siteSettings[key] || ''}
                        onChange={(e) => setSiteSettings({ ...siteSettings, [key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                  className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                  {settingsSaving
                    ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                    : settingsSaved
                    ? <><CheckCircle2 size={15} /> Saved!</>
                    : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
