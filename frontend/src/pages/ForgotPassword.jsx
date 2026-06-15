import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';
import './Login.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetUrl('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      const message = res.data.message || 'If the email exists, a password reset link has been sent.';
      setSuccess(message);
      if (res.data.reset_url) {
        setResetUrl(res.data.reset_url);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Forgot <span className="accent">Password</span></h2>
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}
        {resetUrl && (
          <div className="success-msg reset-link-box">
            <div className="reset-link-label">
              Reset link: <a className="reset-link-url" href={resetUrl} target="_blank" rel="noreferrer">here</a>
            </div>
            <div className="reset-link-hint">Open it to reset the password immediately.</div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <button type="submit" className="btn-login" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        <p className="register-text"><Link to="/login">Back to Login</Link></p>
      </div>
    </div>
  );
}