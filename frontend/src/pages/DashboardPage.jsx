import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw, Pencil, X, Check } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '../store/authStore'
import { membershipApi, paymentApi, authApi } from '../api'
import MembershipBadge from '../components/ui/MembershipBadge'
import FormField from '../components/ui/FormField'

export default function DashboardPage() {
  const { user, logout, fetchMe } = useAuthStore()
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [renewLoading, setRenewLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')
  const navigate = useNavigate()

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    fetchMembership()
  }, [user])

  const fetchMembership = async () => {
    try {
      const res = await membershipApi.getMy()
      setMembership(res.data)
    } catch {
      setMembership(null)
    } finally {
      setLoading(false)
    }
  }

  const startEditing = () => {
    reset({
      full_name: user?.full_name,
      phone: user?.phone,
      age: user?.age,
      gender: user?.gender,
      address: user?.address || '',
      emergency_contact: user?.emergency_contact || '',
      emergency_phone: user?.emergency_phone || '',
    })
    setSaveError('')
    setEditing(true)
  }

  const onSaveProfile = async (data) => {
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

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      document.body.appendChild(script)
    })

  const handleRenew = async () => {
    setRenewLoading(true)
    try {
      const currentYear = new Date().getFullYear()
      // If active membership exists for current year, renew for next year
      const targetYear = membership?.status === 'active' ? currentYear + 1 : currentYear
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
        modal: { ondismiss: () => setRenewLoading(false) },
      }
      new window.Razorpay(options).open()
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not start renewal')
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

  const isActive = membership?.status === 'active'
  const canRenew = !membership || membership.status === 'expired' || membership.status === 'pending'
  const renewLabel = !membership
    ? 'Get Membership — ₹2,000'
    : membership.status === 'pending'
    ? 'Complete Payment'
    : 'Renew Membership — ₹1,500'

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display font-bold text-3xl text-gray-900">
            Hey, {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Your Tirupur Runners dashboard</p>
        </div>

        {/* Membership card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Membership Status</h2>
            <button onClick={fetchMembership} className="text-gray-400 hover:text-gray-600">
              <RefreshCw size={14} />
            </button>
          </div>

          <MembershipBadge membership={membership} />

          {/* Renew button — shown for expired/pending/no membership */}
          {canRenew && (
            <button
              onClick={handleRenew}
              className="btn-primary w-full mt-4"
              disabled={renewLoading}
            >
              {renewLoading
                ? <><Loader2 size={16} className="animate-spin" /> Processing…</>
                : renewLabel}
            </button>
          )}

          {/* Active membership — option to renew for next year */}
          {isActive && (
            <button
              onClick={handleRenew}
              disabled={renewLoading}
              className="w-full mt-3 py-2.5 text-sm text-brand-600 font-medium border border-brand-200 rounded-xl hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {renewLoading
                ? <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Processing…</span>
                : `Renew for Next Year — ₹1,500`}
            </button>
          )}
        </div>

        {/* Profile card */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Your Profile</h2>
            {!editing && (
              <button
                onClick={startEditing}
                className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                <Pencil size={14} /> Edit
              </button>
            )}
          </div>

          {!editing ? (
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Full Name', user?.full_name],
                ['Email', user?.email],
                ['Phone', user?.phone],
                ['Age', user?.age],
                ['Gender', user?.gender],
                ['Emergency Contact', user?.emergency_contact || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{val}</p>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSaveProfile)} className="flex flex-col gap-4">
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
              </div>

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{saveError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-outline flex-1 flex items-center justify-center gap-2"
                  disabled={saveLoading}
                >
                  <X size={14} /> Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={saveLoading}
                >
                  {saveLoading
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : <><Check size={14} /> Save Changes</>}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={() => { logout(); navigate('/') }}
          className="w-full py-3 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
