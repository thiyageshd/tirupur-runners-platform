import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi } from '../api'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState('')
  const [identifierLoading, setIdentifierLoading] = useState(false)
  const [identifierError, setIdentifierError] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [success, setSuccess] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)
  const cooldownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    return () => clearInterval(cooldownRef.current)
  }, [])

  const startCooldown = () => {
    setResendCooldown(60)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) { setIdentifierError('Please enter your email address'); return }
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) { setIdentifierError('Please enter a valid email address'); return }
    setIdentifierLoading(true)
    setIdentifierError('')
    try {
      await authApi.forgotPassword(trimmed)
      setStep(2)
      startCooldown()
    } catch (err) {
      setIdentifierError(err.response?.data?.detail || 'Failed to send OTP. Try again.')
    } finally {
      setIdentifierLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setResendLoading(true)
    setResetError('')
    try {
      await authApi.forgotPassword(email.trim().toLowerCase())
      setOtp('')
      startCooldown()
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Failed to resend OTP. Try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (otp.length !== 6) { setResetError('Please enter the 6-digit OTP'); return }
    if (newPassword.length < 8) { setResetError('Password must be at least 8 characters'); return }
    if (newPassword !== confirmPassword) { setResetError('Passwords do not match'); return }
    setResetLoading(true)
    setResetError('')
    try {
      await authApi.resetPassword(email.trim().toLowerCase(), otp, newPassword)
      setSuccess(true)
      setTimeout(() => navigate('/members/login'), 2000)
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Invalid or expired OTP. Try again.')
    } finally {
      setResetLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen pt-20 pb-12 px-4 bg-gray-50 flex items-center justify-center">
        <div className="card max-w-md w-full text-center py-12">
          <CheckCircle size={48} className="text-brand-500 mx-auto mb-4" />
          <h2 className="font-display font-bold text-2xl text-gray-900 mb-2">Password Updated!</h2>
          <p className="text-gray-500">Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 pb-12 px-4 bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="font-display font-bold text-3xl text-gray-900 mb-2">Reset Password</h1>
          <p className="text-gray-500 text-sm">
            {step === 1
              ? 'Enter your registered email to receive a 6-digit OTP'
              : `OTP sent to ${email} — enter it below to set a new password`}
          </p>
        </div>

        <div className="card">
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <FormField label="Registered Email Address" required error={identifierError}>
                <input
                  type="email"
                  className="input-field"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setIdentifierError('') }}
                />
              </FormField>
              <button type="submit" className="btn-primary w-full" disabled={identifierLoading}>
                {identifierLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Sending OTP…</>
                  : 'Send OTP'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Remember your password?{' '}
                <Link to="/members/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <FormField label="6-Digit OTP" required hint="Check your email — OTP valid for 5 minutes">
                <input
                  className="input-field tracking-widest text-lg font-mono text-center"
                  placeholder="• • • • • •"
                  maxLength={6}
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </FormField>

              <div className="text-right -mt-2">
                {resendCooldown > 0 ? (
                  <span className="text-xs text-gray-400">Resend OTP in {resendCooldown}s</span>
                ) : (
                  <button
                    type="button"
                    className="text-xs text-brand-600 font-medium hover:underline disabled:opacity-50"
                    onClick={handleResendOtp}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending…' : 'Resend OTP'}
                  </button>
                )}
              </div>
              <FormField label="New Password" required>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </FormField>
              <FormField label="Confirm New Password" required>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </FormField>

              {resetError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {resetError}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={resetLoading}>
                {resetLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Resetting…</>
                  : 'Reset Password'}
              </button>
              <button
                type="button"
                className="text-sm text-gray-500 hover:text-gray-700 text-center"
                onClick={() => { setStep(1); setOtp(''); setResetError('') }}
              >
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
