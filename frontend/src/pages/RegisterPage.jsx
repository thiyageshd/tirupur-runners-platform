import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Clock, Loader2, FileText, X } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi, apiClient } from '../api'

const STEPS = ['Account', 'Personal Info', 'Documents']

export default function RegisterPage() {
  const [step, setStep] = useState(0)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [aadharDataUrl, setAadharDataUrl] = useState(null)
  const [aadharMeta, setAadharMeta] = useState(null) // { name, type }
  const [aadharError, setAadharError] = useState('')
  const aadharInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm({ mode: 'onBlur' })

  const STEP_FIELDS = [
    ['full_name', 'email', 'password', 'confirm_password'],
    ['phone', 'age', 'gender', 't_shirt_size'],
    [],
  ]

  const nextStep = async () => {
    const valid = await trigger(STEP_FIELDS[step])
    if (!valid) return
    if (step === 0) {
      try {
        await authApi.checkEmail(watch('email'))
      } catch (err) {
        if (err.response?.status === 409) {
          setError('This email is already registered. Please login instead.')
          return
        }
      }
    }
    if (step === 1) {
      try {
        await authApi.checkPhone(watch('phone'))
      } catch (err) {
        if (err.response?.status === 409) {
          setError('This phone number is already registered. Please login instead.')
          return
        }
      }
    }
    setError('')
    setStep((s) => s + 1)
  }

  const handleAadharChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2097152) {
      setAadharError('File must be under 2MB')
      return
    }
    setAadharError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAadharDataUrl(ev.target.result)
      setAadharMeta({ name: file.name, type: file.type })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const clearAadhar = () => {
    setAadharDataUrl(null)
    setAadharMeta(null)
    setAadharError('')
  }

  const onSubmit = async (data) => {
    if (!aadharDataUrl) {
      setAadharError('Aadhar card is required')
      return
    }
    setLoading(true)
    setError('')
    try {
      // 1. Register user
      await authApi.register(data)

      // 2. Get temp token for uploads only — do NOT store in auth state (no auto-login)
      const loginRes = await authApi.login({ identifier: data.email, password: data.password })
      const tempToken = loginRes.data.access_token

      // 3. Upload Aadhar using temp token
      await apiClient.put('/auth/me/aadhar', { aadhar_data: aadharDataUrl }, {
        headers: { Authorization: `Bearer ${tempToken}` },
      })

      // 4. Save optional profile extras
      if (data.blood_group || data.strava_link) {
        try {
          await apiClient.put('/auth/me/profile', {
            blood_group: data.blood_group || undefined,
            strava_link: data.strava_link || undefined,
          }, { headers: { Authorization: `Bearer ${tempToken}` } })
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

                <FormField label="Confirm Password" required error={errors.confirm_password?.message}>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      className="input-field pr-10"
                      placeholder="Re-enter your password"
                      {...register('confirm_password', {
                        required: 'Please confirm your password',
                        validate: (val) => val === watch('password') || 'Passwords do not match',
                      })}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </FormField>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

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
                  <FormField label="Blood Group" required error={errors.blood_group?.message}>
                    <select className="input-field" {...register('blood_group', { required: 'Blood group is required' })}>
                      <option value="">Select</option>
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
                  <FormField label="Emergency Contact" required error={errors.emergency_contact?.message}>
                    <input
                      className="input-field"
                      placeholder="Contact name"
                      {...register('emergency_contact', { required: 'Emergency contact is required' })}
                    />
                  </FormField>
                  <FormField label="Emergency Phone" required error={errors.emergency_phone?.message}>
                    <input
                      className="input-field"
                      placeholder="Phone number"
                      {...register('emergency_phone', { required: 'Emergency phone is required', pattern: { value: /^[0-9+\-\s]{7,15}$/, message: 'Invalid phone number' } })}
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
                    type="button"
                    className="btn-primary flex-1"
                    onClick={nextStep}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2 — Documents */}
            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="font-semibold text-gray-900 text-lg mb-1">Upload documents</h2>
                  <p className="text-sm text-gray-500">Aadhar card is required for identity verification before approval.</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Aadhar Card <span className="text-red-500">*</span>
                  </p>

                  {aadharDataUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-gray-200">
                      {aadharMeta?.type?.startsWith('image/') ? (
                        <img
                          src={aadharDataUrl}
                          alt="Aadhar preview"
                          className="w-full max-h-56 object-contain bg-gray-50"
                        />
                      ) : (
                        <div className="flex items-center gap-3 p-4 bg-blue-50">
                          <FileText size={28} className="text-blue-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blue-800 truncate">{aadharMeta?.name}</p>
                            <p className="text-xs text-blue-600">PDF document</p>
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={clearAadhar}
                        className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors"
                        title="Remove"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => aadharInputRef.current?.click()}
                      className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-brand-400 transition-colors"
                    >
                      <FileText size={28} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-600">Click to upload Aadhar card</p>
                      <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF · Max 2MB</p>
                    </div>
                  )}

                  <input
                    ref={aadharInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleAadharChange}
                  />

                  {aadharError && <p className="text-xs text-red-500 mt-1.5">{aadharError}</p>}
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
                    disabled={loading || !aadharDataUrl}
                  >
                    {loading
                      ? <><Loader2 size={16} className="animate-spin" /> Submitting…</>
                      : 'Complete Registration'}
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
