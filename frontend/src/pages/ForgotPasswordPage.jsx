import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle } from 'lucide-react'
import FormField from '../components/ui/FormField'
import { authApi } from '../api'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1)
  const [identifier, setIdentifier] = useState('')
  const [identifierLoading, setIdentifierLoading] = useState(false)
  const [identifierError, setIdentifierError] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!identifier.trim()) { setIdentifierError('Please enter your email or mobile number'); return }
    setIdentifierLoading(true)
    setIdentifierError('')
    try {
      await authApi.forgotPassword(identifier.trim())
      setStep(2)
    } catch (err) {
      setIdentifierError(err.response?.data?.detail || 'Failed to send OTP. Try again.')
    } finally {
      setIdentifierLoading(false)
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
      await authApi.resetPassword(identifier.trim(), otp, newPassword)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
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
              ? 'Enter your email or mobile to receive an OTP'
              : 'Enter the OTP sent to your email and set a new password'}
          </p>
        </div>

        <div className="card">
          {step === 1 && (
            <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
              <FormField label="Email or Mobile Number" required error={identifierError}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="you@email.com or 9876543210"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </FormField>
              <button type="submit" className="btn-primary w-full" disabled={identifierLoading}>
                {identifierLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Sending OTP…</>
                  : 'Send OTP'}
              </button>
              <p className="text-center text-sm text-gray-500">
                Remember your password?{' '}
                <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
              </p>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
              <FormField label="OTP" required hint="Check your registered email — OTP valid for 5 minutes">
                <input
                  className="input-field tracking-widest text-lg font-mono text-center"
                  placeholder="• • • • • •"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </FormField>
              <FormField label="New Password" required>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Min. 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </FormField>
              <FormField label="Confirm Password" required>
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
                onClick={() => setStep(1)}
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
