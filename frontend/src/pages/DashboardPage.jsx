import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { membershipApi, paymentApi } from '../api'
import MembershipBadge from '../components/ui/MembershipBadge'

export default function DashboardPage() {
  const { user, logout } = useAuthStore()
  const [membership, setMembership] = useState(null)
  const [loading, setLoading] = useState(true)
  const [renewLoading, setRenewLoading] = useState(false)
  const navigate = useNavigate()

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
      const nextYear = new Date().getFullYear() + 1
      const orderRes = await paymentApi.createOrder(nextYear)
      const order = orderRes.data
      await loadRazorpay()
      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Tirupur Runners Club',
        description: `Membership Renewal ${nextYear}`,
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

  const isExpiredOrNone = !membership || membership.status === 'expired'

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

          {isExpiredOrNone && (
            <button
              onClick={handleRenew}
              className="btn-primary w-full mt-4"
              disabled={renewLoading}
            >
              {renewLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Processing…</>
              ) : (
                membership ? 'Renew Membership — ₹1,500' : 'Get Membership — ₹2,000'
              )}
            </button>
          )}
        </div>

        {/* Profile card */}
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">Your Profile</h2>
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
