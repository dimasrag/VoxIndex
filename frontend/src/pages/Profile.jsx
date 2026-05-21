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
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';


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

      if (removeAvatar && user?.avatar_filename) {
      await apiClient.delete('/auth/me/avatar');
      setRemoveAvatar(false);
    }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        await apiClient.post('/auth/me/avatar', formData);
        setAvatarFile(null);
        setAvatarPreview(null);
      }

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

const handleAvatarSelect = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setAvatarFile(file);
  setAvatarPreview(URL.createObjectURL(file));
};

const handleAvatarRemove = () => {
  setRemoveAvatar(true);
  setAvatarPreview(null);
  setAvatarFile(null);
};

  return (
    <div className="profile-container">
      <div className="profile-card">
        <button className="profile-close" onClick={() => navigate(-1)}>✕</button>

        <div className="profile-avatar-section">
          <div className="profile-avatar-wrap">
            <img
                src={
                  avatarPreview ||
                  (user?.avatar_filename
                    ? `${apiBase}/static/avatars/${user.avatar_filename}`
                    : `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username || 'user'}`)
                }
                alt="avatar"
                className="profile-avatar-img"
              />
              <label className="profile-avatar-edit" title="Upload photo">
                  ✏
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarSelect}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
          <h2 className="profile-name">{user?.username || 'Your name'}</h2>
          <p className="profile-email-sub">{user?.email || 'yourname@gmail.com'}</p>
          {(user?.avatar_filename || avatarPreview) && !removeAvatar && (
            <button type="button" className="profile-remove-avatar" onClick={handleAvatarRemove}>
              Remove photo
            </button>
          )}
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