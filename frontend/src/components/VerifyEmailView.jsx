import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, RefreshCw, ArrowRight, DollarSign, Mail } from 'lucide-react';
import { authAPI } from '../api/client';

export default function VerifyEmailView({ onProceedToLogin }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'success' | 'error'
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [emailInput, setEmailInput] = useState('');
  const [resending, setResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token was found in the link. Please check your email URL.');
      return;
    }

    let isMounted = true;

    const verifyToken = async () => {
      try {
        const res = await authAPI.verifyEmail(token);
        if (isMounted) {
          setStatus('success');
          setMessage(res.data?.message || 'Email verified successfully! You can now log in.');
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setMessage(err.response?.data?.detail || 'Invalid or expired verification link. Please request a new link.');
        }
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-redirect on success countdown
  useEffect(() => {
    if (status !== 'success') return;

    if (countdown <= 0) {
      handleGoToLogin();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [status, countdown]);

  const handleGoToLogin = () => {
    if (onProceedToLogin) {
      onProceedToLogin();
    } else {
      window.history.replaceState({}, '', '/');
      window.location.href = '/';
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (!emailInput) return;
    setResending(true);
    setResendNotice('');
    try {
      const res = await authAPI.resendVerification(emailInput);
      setResendNotice(res.data?.message || 'Verification email resent! Please check your inbox.');
    } catch (err) {
      setResendNotice(err.response?.data?.detail || 'Failed to resend verification email.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-sm mb-4">
            <DollarSign size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Money Manager</h1>
          <p className="text-blue-200 mt-1">AI-Powered Finance Tracker</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center">
          {status === 'loading' && (
            <div className="py-8 space-y-4">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-xl font-bold text-gray-800">Verifying Your Email...</h2>
              <p className="text-sm text-gray-500">
                Please wait a moment while we validate your activation token.
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle size={36} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Email Verified! 🎉</h2>
              <p className="text-sm text-gray-600">{message}</p>
              <div className="p-3 bg-green-50 rounded-xl text-green-700 text-xs font-medium">
                Redirecting to login in <span className="font-bold">{countdown}</span> seconds...
              </div>
              <button
                onClick={handleGoToLogin}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
              >
                <span>Proceed to Sign In</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <AlertTriangle size={36} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Verification Failed</h2>
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100">
                {message}
              </p>

              {/* Resend Form */}
              <form onSubmit={handleResend} className="mt-4 text-left space-y-2 border-t pt-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Request New Verification Link
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resending}
                  className="w-full py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                >
                  {resending ? 'Sending...' : 'Resend Verification Email'}
                </button>
                {resendNotice && (
                  <p className="text-xs text-blue-600 mt-1 text-center">{resendNotice}</p>
                )}
              </form>

              <button
                onClick={handleGoToLogin}
                className="w-full mt-3 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl font-medium text-sm transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
