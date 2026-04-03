import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi } from '../api'
import { useAuthStore } from '../store/authStore'

export default function LoginPage() {
  const [tab, setTab] = useState('password') // 'password' | 'otp'
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { setToken, fetchMe } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm()

  const handlePasswordLogin = async (data) => {
    setLoading(true)
    try {
      const res = await authApi.login({ identifier: data.identifier, password: data.password })
      setToken(res.data.access_token)
      await fetchMe()
      navigate('/members/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials. Check your email/mobile and password.')
    } finally {
      setLoading(false)
    }
  }

  const handleRequestOtp = async () => {
    const email = getValues('email')
    if (!email) { setError('Enter your email first'); return }
    setLoading(true)
    setError('')
    try {
      await authApi.requestOtp(email)
      setOtpSent(true)
    } catch {
      setError('Could not send OTP. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOtpLogin = async (data) => {
    setLoading(true)
    setError('')
    try {
      const res = await authApi.verifyOtp(data.email, data.otp)
      setToken(res.data.access_token)
      await fetchMe()
      navigate('/members/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-gray-900 mb-2">Welcome back</h1>
          <p className="text-gray-500 text-sm">Sign in to your Tirupur Runners account</p>
        </div>

        <div className="card">
          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            {['password', 'otp'].map((t) => (
              <button
                key={t}
                type="button"
                disabled={t === 'otp'}
                onClick={() => { setTab(t); setError(''); setOtpSent(false) }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
                } ${t === 'otp' ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {t === 'password' ? 'Password' : 'OTP Login'}
              </button>
            ))}
          </div>

          {/* Error — persistent, only clears on new submit or tab switch */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-start justify-between gap-2">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 font-bold leading-none shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Password form */}
          {tab === 'password' && (
            <form onSubmit={handleSubmit(handlePasswordLogin)} className="flex flex-col gap-4">
              <FormField label="Email or Mobile Number" required error={errors.identifier?.message}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="you@email.com or 9876543210"
                  autoComplete="username"
                  {...register('identifier', { required: 'Email or mobile number is required' })}
                />
              </FormField>
              <FormField label="Password" required error={errors.password?.message}>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    placeholder="Your password"
                    autoComplete="current-password"
                    {...register('password', { required: 'Password is required' })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>
              <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in…</> : 'Sign In'}
              </button>
              <Link to="/members/forgot-password" className="text-sm text-brand-600 hover:underline text-center block mt-2">
                Forgot Password?
              </Link>
            </form>
          )}

          {/* OTP form */}
          {tab === 'otp' && (
            <form onSubmit={handleSubmit(handleOtpLogin)} className="flex flex-col gap-4">
              <FormField label="Email" required error={errors.email?.message}>
                <div className="flex gap-2">
                  <input
                    type="email"
                    className="input-field flex-1"
                    placeholder="you@example.com"
                    {...register('email', { required: 'Email is required' })}
                  />
                  <button
                    type="button"
                    className="btn-outline whitespace-nowrap py-3 px-4 text-sm"
                    onClick={handleRequestOtp}
                    disabled={loading || otpSent}
                  >
                    {otpSent ? 'Sent ✓' : 'Send OTP'}
                  </button>
                </div>
              </FormField>

              {otpSent && (
                <FormField label="Enter OTP" required error={errors.otp?.message}
                  hint="Check your email — OTP valid for 5 minutes">
                  <input
                    className="input-field tracking-widest text-lg font-mono text-center"
                    placeholder="• • • • • •"
                    maxLength={6}
                    {...register('otp', { required: 'OTP is required', minLength: { value: 6, message: '6-digit OTP' } })}
                  />
                </FormField>
              )}

              {otpSent && (
                <button type="submit" className="btn-primary w-full" disabled={loading}>
                  {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying…</> : 'Verify & Login'}
                </button>
              )}
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            New to Tirupur Runners?{' '}
            <Link to="/members/register" className="text-brand-600 font-medium hover:underline">Join now</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
