import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Clock, Loader2 } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi } from '../api'
import { useAuthStore } from '../store/authStore'

const STEPS = ['Account', 'Personal Info']

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { setToken, fetchMe } = useAuthStore()

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm({ mode: 'onBlur' })

  const STEP_FIELDS = [
    ['full_name', 'email', 'password'],
    ['phone', 'age', 'gender', 't_shirt_size'],
  ]

  const nextStep = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (valid) setStep((s) => s + 1)
  }

  const onSubmit = async (data) => {
    setLoading(true)
    setError('')
    try {
      // 1. Register user
      await authApi.register(data)

      // 2. Login to get token
      const loginRes = await authApi.login({ identifier: data.email, password: data.password })
      setToken(loginRes.data.access_token)
      await fetchMe()

      // 3. Save optional profile extras
      if (data.blood_group || data.strava_link) {
        try {
          await authApi.updateMyProfile({
            blood_group: data.blood_group || undefined,
            strava_link: data.strava_link || undefined,
          })
        } catch {
          // Non-critical
        }
      }

      setSuccess(true)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-16 px-4">
        <div className="card max-w-md w-full text-center py-12">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={32} className="text-amber-600" />
          </div>
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-3">Registration Submitted!</h2>
          <p className="text-gray-600 mb-2">Your registration is <strong>pending admin approval</strong>.</p>
          <p className="text-gray-500 text-sm mb-6">
            You will receive an email once your registration is reviewed. After approval, you can log in and complete your membership payment.
          </p>
          <Link to="/members/login" className="btn-primary inline-block">
            Go to Login
          </Link>
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
          <p className="text-gray-500 text-sm">Register free — membership payment after admin approval</p>
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
                  <Link to="/members/login" className="text-brand-600 font-medium hover:underline">Login</Link>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Emergency Contact 2" error={errors.emergency_contact_2?.message}>
                    <input
                      className="input-field"
                      placeholder="Contact name (optional)"
                      {...register('emergency_contact_2')}
                    />
                  </FormField>
                  <FormField label="Emergency Phone 2" error={errors.emergency_phone_2?.message}>
                    <input
                      className="input-field"
                      placeholder="Phone number (optional)"
                      {...register('emergency_phone_2')}
                    />
                  </FormField>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => setStep(0)}
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
                      <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                    ) : (
                      'Complete Registration'
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
