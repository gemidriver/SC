import React, { useEffect, useMemo, useState } from 'react';
import './ProfilePage.css';
import { AVATAR_OPTIONS, DEFAULT_AVATAR_KEY, getAvatarOption } from '../profileOptions';
import { VERSION } from '../version';

export default function ProfilePage({ user, onSave }) {
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
  const [avatarKey, setAvatarKey] = useState(user?.avatarKey || DEFAULT_AVATAR_KEY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setDisplayName(user?.displayName || user?.username || '');
    setAvatarKey(user?.avatarKey || DEFAULT_AVATAR_KEY);
    setError('');
    setSuccess('');
  }, [user]);

  const selectedAvatar = useMemo(() => getAvatarOption(avatarKey), [avatarKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextDisplayName = displayName.trim();

    if (!nextDisplayName) {
      setError('Display name is required');
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await onSave({ displayName: nextDisplayName, avatarKey });
      setSuccess('Profile saved');
    } catch (err) {
      setError(err.message || 'Could not save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-heading">
          <div className="profile-preview-avatar" style={{ background: selectedAvatar.background }}>
            {selectedAvatar.mark}
          </div>
          <div>
            <div className="profile-title">Your profile</div>
            <div className="profile-subtitle">
              Update the name and avatar shown around the app.
            </div>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="profile-field">
            <label className="profile-label">Username</label>
            <input className="profile-input profile-input-readonly" type="text" value={user?.username || ''} readOnly />
          </div>

          <div className="profile-field">
            <label className="profile-label" htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="profile-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              maxLength={40}
              autoComplete="nickname"
            />
          </div>

          <div className="profile-field">
            <span className="profile-label">Choose avatar</span>
            <div className="profile-avatar-grid">
              {AVATAR_OPTIONS.map((option) => {
                const selected = option.key === avatarKey;
                return (
                  <button
                    key={option.key}
                    className={`profile-avatar-option ${selected ? 'selected' : ''}`}
                    type="button"
                    onClick={() => setAvatarKey(option.key)}
                    aria-pressed={selected}
                  >
                    <div className="profile-avatar-swatch" style={{ background: option.background }}>
                      {option.mark}
                    </div>
                    <span className="profile-avatar-label">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {(error || success) && (
            <div className={`profile-message ${error ? 'error' : 'success'}`}>
              {error || success}
            </div>
          )}

          <div className="profile-actions">
            <button className="profile-save-btn" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </form>
      </div>

      <div className="profile-version">The Rage Trader v{VERSION}</div>
    </div>
  );
}
