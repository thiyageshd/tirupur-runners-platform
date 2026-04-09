import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, Pencil, X, Check, Camera, AlertTriangle, FileText, Lock, Eye, EyeOff, Upload } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import { useAuthStore } from '../store/authStore'
import { membershipApi, paymentApi, authApi } from '../api'
import MembershipBadge from '../components/ui/MembershipBadge'
import FormField from '../components/ui/FormField'

export default function DashboardPage() {
  const { user, logout, fetchMe } = useAuthStore()
  const [membership, setMembership] = useState(null)
  const [nextYearMembership, setNextYearMembership] = useState(null)
  const [nextFyYear, setNextFyYear] = useState(null)
  const [memberProfile, setMemberProfile] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [renewLoading, setRenewLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [profileTab, setProfileTab] = useState('user')
  const navigate = useNavigate()

  const { register, handleSubmit, reset, formState: { errors } } = useForm()
  const fileInputRef = useRef(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const aadharInputRef = useRef(null)
  const [aadharUploading, setAadharUploading] = useState(false)
  const [aadharError, setAadharError] = useState('')

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const { register: registerPw, handleSubmit: handleSubmitPw, reset: resetPw, watch: watchPw, formState: { errors: pwErrors } } = useForm()

  useEffect(() => {
    if (!user) { navigate('/members/login'); return }
    fetchMembership()
  }, [user])

  const fetchMembership = async () => {
    try {
      const [latestRes, profileRes, paymentsRes] = await Promise.allSettled([
        membershipApi.getMy(),
        authApi.getMyProfile(),
        paymentApi.getMyPayments(),
      ])
      const latestMembership = latestRes.status === 'fulfilled' ? latestRes.value.data : null
      setMembership(latestMembership)
      setMemberProfile(profileRes.status === 'fulfilled' ? profileRes.value.data : null)
      setPayments(paymentsRes.status === 'fulfilled' ? paymentsRes.value.data : [])

      // Next FY year = current membership year + 1 (e.g. year=2025 → next=2026)
      const fyNext = latestMembership ? latestMembership.year + 1 : new Date().getFullYear()
      setNextFyYear(fyNext)
      const nextRes = await membershipApi.getMy(fyNext).catch(() => null)
      setNextYearMembership(nextRes?.data || null)
    } catch {
      setMembership(null)
      setNextYearMembership(null)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    if (profileTab === 'user') {
      reset({
        full_name: user?.full_name,
        phone: user?.phone,
        age: user?.age,
        gender: user?.gender,
        address: user?.address || '',
        emergency_contact: user?.emergency_contact || '',
        emergency_phone: user?.emergency_phone || '',
        emergency_contact_2: user?.emergency_contact_2 || '',
        emergency_phone_2: user?.emergency_phone_2 || '',
      })
    } else {
      reset({
        blood_group: memberProfile?.blood_group || '',
        strava_link: memberProfile?.strava_link || '',
        profession: memberProfile?.profession || '',
        interests: memberProfile?.interests || '',
        bio: memberProfile?.bio || '',
      })
    }
    setSaveError('')
    setEditing(true)
  }

  const onSaveUserProfile = async (data) => {
    setSaveLoading(true)
    setSaveError('')
    try {
      await authApi.updateProfile(data)
      await fetchMe()
      setEditing(false)
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Try again.')
    } finally {
      setSaveLoading(false)
    }
  }

  const onSaveRunnerProfile = async (data) => {
    setSaveLoading(true)
    setSaveError('')
    try {
      await authApi.updateMyProfile(data)
      const profileRes = await authApi.getMyProfile()
      setMemberProfile(profileRes.data)
      setEditing(false)
    } catch (err) {
      setSaveError(err.response?.data?.detail || 'Failed to save. Try again.')
    } finally {
      setSaveLoading(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 512000) {
      setPhotoError('Image must be under 500KB')
      return
    }
    setPhotoError('')
    setPhotoUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const res = await authApi.uploadPhoto(ev.target.result)
        setMemberProfile(res.data)
      } catch (err) {
        setPhotoError(err.response?.data?.detail || 'Upload failed')
      } finally {
        setPhotoUploading(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const handleAadharChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2097152) {
      setAadharError('File must be under 2MB')
      return
    }
    setAadharError('')
    setAadharUploading(true)
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const res = await authApi.uploadAadhar(ev.target.result)
        setMemberProfile(res.data)
      } catch (err) {
        setAadharError(err.response?.data?.detail || 'Upload failed')
      } finally {
        setAadharUploading(false)
        e.target.value = ''
      }
    }
    reader.readAsDataURL(file)
  }

  const onChangePassword = async (data) => {
    setPwLoading(true)
    setPwError('')
    try {
      await authApi.changePassword({ current_password: data.current_password, new_password: data.new_password })
      setPwSuccess(true)
      setTimeout(() => {
        setShowPasswordModal(false)
        setPwSuccess(false)
        resetPw()
      }, 2000)
    } catch (err) {
      setPwError(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setPwLoading(false)
    }
  }

  const openReceipt = (payment) => {
    // Use server-generated receipt if available
    if (payment.receipt_url) {
      window.open(payment.receipt_url, '_blank')
      return
    }
    // Fallback: generate inline (for older payments without receipt_url)
    const yearStr = payment.idempotency_key?.split(':').pop() || ''
    const yearNum = parseInt(yearStr, 10)
    const fyLabel = yearNum ? `FY ${yearNum}–${String(yearNum + 1).slice(-2)}` : '—'
    const isOffline = payment.idempotency_key?.startsWith('offline:')
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Receipt – Tirupur Runners Club</title>
<style>
  body{font-family:sans-serif;max-width:480px;margin:48px auto;padding:24px;color:#111}
  h2{color:#16a34a;margin:0 0 2px}
  .sub{color:#888;font-size:13px;margin-bottom:28px}
  table{width:100%;border-collapse:collapse}
  td{padding:9px 0;border-bottom:1px solid #f0f0f0;font-size:14px;vertical-align:top}
  td:first-child{color:#888;width:38%}
  td:last-child{font-weight:500;word-break:break-all}
  .amount{font-size:20px;font-weight:700;color:#16a34a}
  .badge{display:inline-block;background:#dcfce7;color:#15803d;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .footer{margin-top:28px;font-size:11px;color:#bbb;text-align:center;border-top:1px solid #f0f0f0;padding-top:16px}
  .print-btn{margin-top:20px;padding:8px 20px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}
  @media print{.print-btn{display:none}}
</style></head><body>
<h2>Tirupur Runners Club</h2>
<p class="sub">Membership Payment Receipt</p>
<table>
  <tr><td>Member</td><td>${user?.full_name || ''}</td></tr>
  <tr><td>Email</td><td>${user?.email || ''}</td></tr>
  <tr><td>Phone</td><td>${user?.phone || ''}</td></tr>
  <tr><td>Membership</td><td>${fyLabel}${isOffline ? ' (Offline)' : ''}</td></tr>
  <tr><td>Payment Ref</td><td>${payment.razorpay_payment_id || payment.razorpay_order_id}</td></tr>
  <tr><td>Date</td><td>${payment.created_at ? new Date(payment.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—'}</td></tr>
  <tr><td>Status</td><td><span class="badge">Paid</span></td></tr>
  <tr><td>Amount</td><td class="amount">&#8377;${(payment.amount_paise / 100).toLocaleString('en-IN')}</td></tr>
</table>
<button class="print-btn" onclick="window.print()">Print Receipt</button>
<p class="footer">Tirupur Runners Club · tirupurrunners@gmail.com · +91 94882 52599</p>
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
  }

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      document.body.appendChild(script)
    })

  const handleRenew = async (targetYear) => {
    setRenewLoading(true)
    try {
      const orderRes = await paymentApi.createOrder(targetYear)
      const order = orderRes.data
      await loadRazorpay()
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Tirupur Runners Club',
        description: order.is_renewal ? `Membership Renewal ${targetYear}` : `New Membership ${targetYear}`,
        order_id: order.order_id,
        handler: async (response) => {
          await paymentApi.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })
          await fetchMembership()
        },
        prefill: { name: user.full_name, email: user.email, contact: user.phone },
        theme: { color: '#16a34a' },
      }
      new window.Razorpay(options).open()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not start renewal')
    } finally {
      setRenewLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-600" />
      </div>
    )
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const isActive = membership?.status === 'active'
  const canRenew = !membership || membership.status === 'expired' || membership.status === 'pending' || membership.status === 'pending_payment'

  // Show early-renewal option only in the final month before expiry
  const endDate = membership?.end_date ? new Date(membership.end_date) : null
  const monthsUntilExpiry = endDate
    ? (endDate.getFullYear() - today.getFullYear()) * 12 + (endDate.getMonth() - today.getMonth())
    : 999
  const showNextYearRenew = isActive && monthsUntilExpiry <= 1 && monthsUntilExpiry >= 0 && !nextYearMembership
  const accountStatus = user?.account_status || 'approved'

  const renewLabel = !membership
    ? 'Get Membership — ₹2,000'
    : (membership.status === 'pending' || membership.status === 'pending_payment')
    ? 'Complete Payment'
    : 'Renew Membership — ₹1,500'

  const paidPayments = payments.filter(p => p.status === 'paid')

  const PROFILE_TABS = [
    { key: 'user', label: 'User Profile' },
    { key: 'runner', label: 'Runner Profile' },
    { key: 'payments', label: 'Receipts' },
  ]

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-gray-900">
            Hey, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Your Tirupur Runners dashboard</p>
        </div>

        {/* Account status banner */}
        {accountStatus === 'pending_approval' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 flex gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Registration pending approval</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Your account is being reviewed by the admin. You will receive an email once approved and can then complete your membership payment.
              </p>
              <p className="text-xs text-amber-600 mt-1">Contact: tirupurrunners@gmail.com · +91 94882 52599</p>
            </div>
          </div>
        )}
        {accountStatus === 'rejected' && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-4 flex gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Registration not approved</p>
              <p className="text-sm text-red-700 mt-0.5">
                Your registration was not approved. Please contact the club for assistance.
              </p>
              <p className="text-xs text-red-600 mt-1">Contact: tirupurrunners@gmail.com · +91 94882 52599</p>
            </div>
          </div>
        )}

        {/* Membership card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Membership Status</h2>
            <button onClick={fetchMembership} className="text-gray-400 hover:text-gray-600">
              <RefreshCw size={14} />
            </button>
          </div>

          <MembershipBadge membership={membership} />

          {canRenew && accountStatus === 'approved' && (
            <button
              onClick={() => handleRenew(currentYear)}
              className="btn-primary w-full mt-4"
              disabled={renewLoading}
            >
              {renewLoading
                ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                : renewLabel}
            </button>
          )}

          {showNextYearRenew && accountStatus === 'approved' && nextFyYear && (
            <button
              onClick={() => handleRenew(nextFyYear)}
              disabled={renewLoading}
              className="w-full mt-3 py-2.5 text-sm text-brand-600 font-medium border border-brand-200 rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {renewLoading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing…</span>
                : `Renew for FY ${nextFyYear}–${String(nextFyYear + 1).slice(-2)} — ₹1,500`}
            </button>
          )}
        </div>

        {/* Profile card with tabs */}
        <div className="card mb-6">
          {/* Tab bar */}
          <div className="border-b border-gray-100 -mx-6 px-6 mb-5">
            <div className="flex items-center justify-between">
              <div className="flex">
                {PROFILE_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setProfileTab(key); setEditing(false) }}
                    className={`text-sm font-medium px-4 py-3 border-b-2 -mb-px transition-colors whitespace-nowrap ${
                      profileTab === key
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {profileTab !== 'payments' && !editing && (
                <button
                  onClick={startEditing}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium py-3 px-2"
                >
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          </div>

          {/* ── Tab 1: User Profile ── */}
          {profileTab === 'user' && !editing && (
            <div className="space-y-4">
              {/* Profile photo */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-24 h-24">
                  {memberProfile?.photo_url ? (
                    <img
                      src={memberProfile.photo_url}
                      alt={user?.full_name}
                      className="w-24 h-24 rounded-full object-cover border-2 border-brand-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-2xl border-2 border-brand-200">
                      {user?.full_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoUploading}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-brand-600 hover:bg-brand-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                    title="Upload photo"
                  >
                    {photoUploading
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Camera size={13} />}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                  />
                </div>
                {photoError && <p className="text-xs text-red-500">{photoError}</p>}
                <p className="text-xs text-gray-400">Max 500KB · JPG or PNG</p>
              </div>

              {/* Basic info grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  ['Full Name', user?.full_name],
                  ['Email', user?.email],
                  ['Phone', user?.phone],
                  ['Age', user?.age],
                  ['Gender', user?.gender],
                  ['Emergency Contact', user?.emergency_contact || '—'],
                  ['Emergency Phone', user?.emergency_phone || '—'],
                  ['Emergency Contact 2', user?.emergency_contact_2 || '—'],
                  ['Emergency Phone 2', user?.emergency_phone_2 || '—'],
                ].map(([label, val]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-medium text-gray-800">{val}</p>
                  </div>
                ))}
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Address</p>
                  <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{user?.address || '—'}</p>
                </div>
              </div>

              {/* Aadhar */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Documents</p>
                <div>
                  <p className="text-xs text-gray-400 mb-2">Aadhar Card</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    {memberProfile?.aadhar_url && (
                      <>
                        <span className="text-xs font-medium text-green-700 bg-green-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Check size={11} /> Uploaded
                        </span>
                        <button
                          onClick={() => {
                            try {
                              const arr = memberProfile.aadhar_url.split(',')
                              const mime = arr[0].match(/:(.*?);/)[1]
                              const bstr = atob(arr[1])
                              const u8arr = new Uint8Array(bstr.length)
                              for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i)
                              const url = URL.createObjectURL(new Blob([u8arr], { type: mime }))
                              window.open(url, '_blank')
                            } catch {
                              window.open(memberProfile.aadhar_url, '_blank')
                            }
                          }}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                        >
                          <FileText size={12} /> View
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => aadharInputRef.current?.click()}
                      disabled={aadharUploading}
                      className="text-xs text-gray-500 hover:text-brand-600 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {aadharUploading
                        ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                        : <><Upload size={12} /> {memberProfile?.aadhar_url ? 'Replace' : 'Upload'}</>}
                    </button>
                    <input
                      ref={aadharInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleAadharChange}
                    />
                  </div>
                  {aadharError && <p className="text-xs text-red-500 mt-1">{aadharError}</p>}
                  <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF · Max 2MB</p>
                </div>
              </div>

              {/* Change password */}
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={() => { setShowPasswordModal(true); setPwError(''); setPwSuccess(false); resetPw() }}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-brand-600 transition-colors"
                >
                  <Lock size={14} /> Change Password
                </button>
              </div>
            </div>
          )}

          {profileTab === 'user' && editing && (
            <form onSubmit={handleSubmit(onSaveUserProfile)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Full Name" required error={errors.full_name?.message}>
                  <input className="input-field" {...register('full_name', { required: 'Required' })} />
                </FormField>
                <FormField label="Phone" required error={errors.phone?.message}>
                  <input className="input-field" {...register('phone', {
                    required: 'Required',
                    pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid phone' }
                  })} />
                </FormField>
                <FormField label="Age" required error={errors.age?.message}>
                  <input type="number" className="input-field" {...register('age', {
                    required: 'Required', valueAsNumber: true,
                    min: { value: 5, message: 'Min 5' }, max: { value: 100, message: 'Max 100' }
                  })} />
                </FormField>
                <FormField label="Gender" required error={errors.gender?.message}>
                  <select className="input-field" {...register('gender', { required: 'Required' })}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="not_specified">Prefer not to say</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Address" error={errors.address?.message}>
                <input className="input-field" placeholder="Your address (optional)" {...register('address')} />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Emergency Contact" error={errors.emergency_contact?.message}>
                  <input className="input-field" placeholder="Contact name" {...register('emergency_contact')} />
                </FormField>
                <FormField label="Emergency Phone" error={errors.emergency_phone?.message}>
                  <input className="input-field" placeholder="Phone number" {...register('emergency_phone')} />
                </FormField>
                <FormField label="Emergency Contact 2" error={errors.emergency_contact_2?.message}>
                  <input className="input-field" placeholder="Contact name (optional)" {...register('emergency_contact_2')} />
                </FormField>
                <FormField label="Emergency Phone 2" error={errors.emergency_phone_2?.message}>
                  <input className="input-field" placeholder="Phone number (optional)" {...register('emergency_phone_2')} />
                </FormField>
              </div>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="btn-outline flex-1 flex items-center justify-center gap-2" disabled={saveLoading}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saveLoading}>
                  {saveLoading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          )}

          {/* ── Tab 2: Runner Profile ── */}
          {profileTab === 'runner' && !editing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">T-Shirt Size</p>
                {user?.t_shirt_size
                  ? <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{user.t_shirt_size}</span>
                  : <p className="text-sm text-gray-400">—</p>}
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Blood Group</p>
                <p className="text-sm font-medium text-gray-800">{memberProfile?.blood_group || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Profession</p>
                <p className="text-sm font-medium text-gray-800">{memberProfile?.profession || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Strava</p>
                {memberProfile?.strava_link
                  ? <a href={memberProfile.strava_link} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:underline truncate block">View Profile</a>
                  : <p className="text-sm text-gray-400">—</p>}
              </div>
              {memberProfile?.interests && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Interests</p>
                  <p className="text-sm text-gray-700">{memberProfile.interests}</p>
                </div>
              )}
              {memberProfile?.bio && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-400 mb-0.5">Bio</p>
                  <p className="text-sm text-gray-700">{memberProfile.bio}</p>
                </div>
              )}
            </div>
          )}

          {profileTab === 'runner' && editing && (
            <form onSubmit={handleSubmit(onSaveRunnerProfile)} className="flex flex-col gap-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-xs text-gray-500">T-Shirt Size</p>
                {user?.t_shirt_size
                  ? <span className="inline-block bg-brand-100 text-brand-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">{user.t_shirt_size}</span>
                  : <span className="text-xs text-gray-400">— (contact admin to update)</span>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Blood Group" error={errors.blood_group?.message}>
                  <select className="input-field" {...register('blood_group')}>
                    <option value="">Select (optional)</option>
                    {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Profession" error={errors.profession?.message}>
                  <input className="input-field" placeholder="e.g. Software Engineer" {...register('profession')} />
                </FormField>
                <FormField label="Strava Profile URL" error={errors.strava_link?.message}>
                  <input className="input-field" placeholder="https://strava.com/athletes/..." {...register('strava_link')} />
                </FormField>
              </div>
              <FormField label="Interests" error={errors.interests?.message}>
                <input className="input-field" placeholder="e.g. trail running, cycling, swimming" {...register('interests')} />
              </FormField>
              <FormField label="Bio" error={errors.bio?.message}>
                <textarea className="input-field resize-none" rows={3} placeholder="Tell us about yourself…" {...register('bio')} />
              </FormField>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveError}</p>
              )}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditing(false)} className="btn-outline flex-1 flex items-center justify-center gap-2" disabled={saveLoading}>
                  <X size={14} /> Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={saveLoading}>
                  {saveLoading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Check size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          )}

          {/* ── Tab 3: Payment Receipts ── */}
          {profileTab === 'payments' && (
            paidPayments.length === 0 ? (
              <div className="text-center py-8">
                <FileText size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No payment receipts yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paidPayments.map((p) => {
                  const yearStr = p.idempotency_key?.split(':').pop() || ''
                  const yearNum = parseInt(yearStr, 10)
                  const fyLabel = yearNum ? `FY ${yearNum}–${String(yearNum + 1).slice(-2)}` : ''
                  return (
                    <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">
                          ₹{(p.amount_paise / 100).toLocaleString('en-IN')}
                          {fyLabel && <span className="ml-2 text-xs font-normal text-gray-500">{fyLabel}</span>}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.created_at ? format(new Date(p.created_at), 'dd MMM yyyy') : '—'}
                          {p.razorpay_payment_id && (
                            <span className="ml-2 font-mono">{p.razorpay_payment_id.slice(-8)}</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => openReceipt(p)}
                        className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 flex-shrink-0"
                      >
                        <FileText size={12} /> Receipt
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          )}
        </div>

        <button
          onClick={() => { logout(); navigate('/') }}
          className="w-full py-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Password change modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900 text-lg">Change Password</h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {pwSuccess ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Check size={22} className="text-green-600" />
                </div>
                <p className="text-sm font-medium text-gray-800">Password changed successfully!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitPw(onChangePassword)} className="flex flex-col gap-4">
                <FormField label="Current Password" required error={pwErrors.current_password?.message}>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Your current password"
                      {...registerPw('current_password', { required: 'Required' })}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowCurrentPw(!showCurrentPw)}>
                      {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>
                <FormField label="New Password" required error={pwErrors.new_password?.message}>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Min. 8 characters"
                      {...registerPw('new_password', {
                        required: 'Required',
                        minLength: { value: 8, message: 'Minimum 8 characters' },
                      })}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNewPw(!showNewPw)}>
                      {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>
                <FormField label="Confirm New Password" required error={pwErrors.confirm_new_password?.message}>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Repeat new password"
                      {...registerPw('confirm_new_password', {
                        required: 'Required',
                        validate: (val) => val === watchPw('new_password') || 'Passwords do not match',
                      })}
                    />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowConfirmPw(!showConfirmPw)}>
                      {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                {pwError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{pwError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="btn-outline flex-1"
                    disabled={pwLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    disabled={pwLoading}
                  >
                    {pwLoading ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
