import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import './Profile.css';

export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);


  const handleSaveClick = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username.trim()) { setError('Name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (showPasswordFields) {
      if (!password) { setError('Please enter a new password'); return; }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmedSubmit = async () => {
    setShowConfirmDialog(false);
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await apiClient.patch('/auth/me', {
        username: username || undefined,
        email: email || undefined,
        password: showPasswordFields && password ? password : undefined,
      });
      setSuccess('Changes saved successfully!');
      setPassword('');
      setConfirmPassword('');
      setShowPasswordFields(false);
      
      if (username !== user?.username) {
        setSuccess('Username changed! Please log in again.');
        setTimeout(() => {
          logout();
          window.location.href = '/login';
        }, 1500);
        return;
      }
    await refreshUser();

    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-card">
        <button className="profile-close" onClick={() => navigate(-1)}>✕</button>

        <div className="profile-avatar-section">
          <div className="profile-avatar-wrap">
            <img
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'user'}`}
              alt="avatar"
              className="profile-avatar-img"
            />
            <div className="profile-avatar-edit">✏</div>
          </div>
          <h2 className="profile-name">{user?.username || 'Your name'}</h2>
          <p className="profile-email-sub">{user?.email || 'yourname@gmail.com'}</p>
        </div>

        <div className="profile-divider" />

        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}

        <form onSubmit={handleSaveClick}>
          <div className="profile-field">
            <label>Name</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="profile-field">
            <label>Email account</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="profile-field">
            <label>Password</label>
            {!showPasswordFields ? (
              <button type="button" className="profile-change-pw" onClick={() => setShowPasswordFields(true)}>
                Change Password
              </button>
            ) : (
              <div className="profile-pw-fields">
                <input type="password" value={password} placeholder="New password" onChange={e => setPassword(e.target.value)} />
                <input type="password" value={confirmPassword} placeholder="Confirm new password" onChange={e => setConfirmPassword(e.target.value)} />
                <button type="button" className="profile-cancel-pw" onClick={() => { setShowPasswordFields(false); setPassword(''); setConfirmPassword(''); }}>
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="profile-actions">
            <button type="submit" className="btn-save" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {showConfirmDialog && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <h3>Save Changes</h3>
              <p>Are you sure you want to save these changes?</p>
              <div className="confirm-actions">
                <button type="button" className="confirm-cancel" onClick={() => setShowConfirmDialog(false)}>Cancel</button>
                <button type="button" className="confirm-ok" onClick={handleConfirmedSubmit}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}