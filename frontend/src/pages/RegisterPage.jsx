import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, CheckCircle, Loader2 } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi, paymentApi } from '../api'
import { useAuthStore } from '../store/authStore'

const STEPS = ['Account', 'Personal Info', 'Payment']

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { setToken, fetchMe } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({ mode: 'onBlur' })

  const STEP_FIELDS = [
    ['full_name', 'email', 'password'],
    ['phone', 'age', 'gender', 'address', 'emergency_contact', 'emergency_phone', 't_shirt_size'],
  ]

  const nextStep = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => s + 1)
  }

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true)
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const onSubmit = async (data) => {
    setLoading(true)
    setError('')
    try {
      // 1. Register user (t_shirt_size included; blood_group + strava_link ignored by register endpoint)
      await authApi.register(data)

      // 2. Login to get token
      const loginRes = await authApi.login({ identifier: data.email, password: data.password })
      const token = loginRes.data.access_token
      setToken(token)
      await fetchMe()

      // 3. Save optional profile extras
      if (data.blood_group || data.strava_link) {
        try {
          await authApi.updateMyProfile({
            blood_group: data.blood_group || undefined,
            strava_link: data.strava_link || undefined,
          })
        } catch {
          // Non-critical — continue to payment
        }
      }

      // 4. Create Razorpay order
      const orderRes = await paymentApi.createOrder(new Date().getFullYear())
      const order = orderRes.data

      // 5. Load Razorpay checkout
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load Razorpay')

      const options = {
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Tirupur Runners Club',
        description: `Annual Membership ${new Date().getFullYear()}`,
        order_id: order.order_id,
        handler: async (response) => {
          try {
            await paymentApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            })
            setSuccess(true)
            setTimeout(() => navigate('/members/dashboard'), 2500)
          } catch {
            setError('Payment verification failed. Contact support.')
          }
        },
        prefill: {
          name: data.full_name,
          email: data.email,
          contact: data.phone,
        },
        theme: { color: '#16a34a' },
        modal: {
          ondismiss: () => setLoading(false),
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Registration failed')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="card max-w-md w-full text-center py-12">
          <CheckCircle size={56} className="text-brand-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">Welcome to the club!</h2>
          <p className="text-gray-500">Your membership is active. Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gray-50">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-gray-900 mb-2">Join Tirupur Runners</h1>
          <p className="text-gray-500 text-sm">New member annual membership — ₹2,000</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                i === step
                  ? 'bg-brand-600 text-white'
                  : i < step
                  ? 'bg-brand-100 text-brand-700'
                  : 'bg-gray-100 text-gray-400'
              }`}>
                <span className={`w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
                  i < step ? 'bg-brand-500 text-white' : ''
                }`}>
                  {i < step ? '✓' : i + 1}
                </span>
                {label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-0.5 ${i < step ? 'bg-brand-400' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Step 0 — Account */}
            {step === 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-semibold text-gray-900 text-lg mb-1">Create your account</h2>

                <FormField label="Full Name" required error={errors.full_name?.message}>
                  <input
                    className="input-field"
                    placeholder="e.g. Thiyagesh Dhandapani"
                    {...register('full_name', { required: 'Full name is required', minLength: { value: 2, message: 'Too short' } })}
                  />
                </FormField>

                <FormField label="Email Address" required error={errors.email?.message}>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="you@example.com"
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' },
                    })}
                  />
                </FormField>

                <FormField label="Password" required error={errors.password?.message}>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Min. 8 characters"
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 8, message: 'Minimum 8 characters' },
                      })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowPass(!showPass)}
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                <button type="button" className="btn-primary w-full mt-2" onClick={nextStep}>
                  Continue →
                </button>

                <p className="text-center text-sm text-gray-500">
                  Already a member?{' '}
                  <Link to="/login" className="text-brand-600 font-medium hover:underline">Login</Link>
                </p>
              </div>
            )}

            {/* Step 1 — Personal Info */}
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <h2 className="font-semibold text-gray-900 text-lg mb-1">Personal details</h2>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Phone" required error={errors.phone?.message}>
                    <input
                      className="input-field"
                      placeholder="9876543210"
                      {...register('phone', {
                        required: 'Phone is required',
                        pattern: { value: /^[6-9]\d{9}$/, message: 'Invalid Indian phone number' },
                      })}
                    />
                  </FormField>

                  <FormField label="Age" required error={errors.age?.message}>
                    <input
                      type="number"
                      className="input-field"
                      placeholder="28"
                      {...register('age', {
                        required: 'Age is required',
                        min: { value: 5, message: 'Min age 5' },
                        max: { value: 100, message: 'Max age 100' },
                        valueAsNumber: true,
                      })}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Gender" required error={errors.gender?.message}>
                    <select
                      className="input-field"
                      {...register('gender', { required: 'Gender is required' })}
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </FormField>

                  <FormField label="T-Shirt Size" required error={errors.t_shirt_size?.message}>
                    <select
                      className="input-field"
                      {...register('t_shirt_size', { required: 'T-shirt size is required' })}
                    >
                      <option value="">Select size</option>
                      {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </FormField>
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

                  <FormField label="Strava Profile" error={errors.strava_link?.message}>
                    <input
                      className="input-field"
                      placeholder="strava.com/athletes/... (optional)"
                      {...register('strava_link')}
                    />
                  </FormField>
                </div>

                <FormField label="Address" error={errors.address?.message}>
                  <textarea
                    className="input-field resize-none"
                    rows={2}
                    placeholder="Your address (optional)"
                    {...register('address')}
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Emergency Contact" error={errors.emergency_contact?.message}>
                    <input
                      className="input-field"
                      placeholder="Contact name"
                      {...register('emergency_contact')}
                    />
                  </FormField>
                  <FormField label="Emergency Phone" error={errors.emergency_phone?.message}>
                    <input
                      className="input-field"
                      placeholder="Phone number"
                      {...register('emergency_phone')}
                    />
                  </FormField>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => setStep(0)}
                  >
                    ← Back
                  </button>
                  <button type="button" className="btn-primary flex-1" onClick={nextStep}>
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Payment */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <h2 className="font-semibold text-gray-900 text-lg mb-1">Complete membership</h2>

                {/* Summary */}
                <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-700">Annual Membership {new Date().getFullYear()} — New Member</span>
                    <span className="font-bold text-brand-700">₹2,000</span>
                  </div>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>✓ Access to all club runs</li>
                    <li>✓ Marathon event discounts</li>
                    <li>✓ Training support & coaching</li>
                    <li>✓ Valid for 12 months</li>
                  </ul>
                </div>

                <div className="text-xs text-gray-400 flex items-center gap-2">
                  <span>🔒</span>
                  <span>Payments powered by Razorpay — UPI, cards, netbanking accepted</span>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => setStep(1)}
                    disabled={loading}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary flex-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 size={16} className="animate-spin" /> Processing…</>
                    ) : (
                      'Pay ₹2,000 & Join'
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
