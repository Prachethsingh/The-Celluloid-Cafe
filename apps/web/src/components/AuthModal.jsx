import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import { useDialog } from '../hooks/useDialog';

export default function AuthModal({ onClose, onSuccess }) {
  const dialog = useDialog(onClose);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [user, setUser] = useState(api.user);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [sessions, setSessions] = useState([]);
  const download = data => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'cinepulse-data.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const submit = async event => {
    event.preventDefault(); setError(null); setBusy(true);
    try { const account = await api.authenticate(mode, email, password, name); setUser(account); setPassword(''); onSuccess?.(); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };
  return <div className="modal-backdrop animate-fade-in" onClick={onClose}>
    <div ref={dialog} className="auth-modal-content glass-panel" role="dialog" aria-modal="true" aria-labelledby="account-heading" onClick={event => event.stopPropagation()}>
      <button className="modal-close-btn" aria-label="Close modal" onClick={onClose}><X size={20} /></button>
      <h2 id="account-heading" className="auth-title">Account & Privacy</h2>
      <p>Browse anonymously. Sign in to save your library across sessions.</p>
      {error && <p role="alert">{error}</p>}
      {user ? <div>
        <p>Signed in as <strong>{user.display_name}</strong> ({user.email})</p>
        <button className="btn-secondary" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          try { await api.signOut(); setUser(null); onSuccess?.(); }
          catch (reason) { setError(reason.message); }
          finally { setBusy(false); }
        }}>Sign out</button>
        <button className="btn-secondary" onClick={async () => { try { download(await api.request('/auth/export')); } catch (reason) { setError(reason.message); } }}>Export account data</button>
        <details style={{ marginTop: 20 }}><summary>Change password</summary>
          <form onSubmit={async event => {
            event.preventDefault(); setBusy(true); setError(null);
            try {
              const result = await api.request('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
              api.csrf = result.csrf; api.user = result.user; setCurrentPassword(''); setNewPassword(''); setSessions([]);
            } catch (reason) { setError(reason.message); }
            finally { setBusy(false); }
          }}>
            <label htmlFor="current-password">Current password</label><input id="current-password" className="form-input" type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
            <label htmlFor="new-password">New password</label><input id="new-password" className="form-input" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
            <button className="btn-secondary" disabled={busy}>Update password and sign out other sessions</button>
          </form>
        </details>
        <button className="btn-secondary" onClick={async () => { try { setSessions((await api.request('/auth/sessions')).sessions); } catch (reason) { setError(reason.message); } }}>Show active sessions</button>
        {sessions.length > 0 && <ul>{sessions.map(session => <li key={session.id}>{session.current ? 'Current session' : 'Another session'} — expires {new Date(session.expires_at).toLocaleString()} <button className="btn-secondary" onClick={async () => {
          try {
            if (session.current) { await api.signOut(); setUser(null); setSessions([]); onSuccess?.(); }
            else { await api.request('/auth/sessions/' + session.id, { method: 'DELETE' }); setSessions(items => items.filter(item => item.id !== session.id)); }
          } catch (reason) { setError(reason.message); }
        }}>Sign out session</button></li>)}</ul>}
        <form onSubmit={async event => {
          event.preventDefault(); setBusy(true); setError(null);
          try { await api.request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }); api.user = null; api.csrf = null; localStorage.setItem('mp_watchlist', '[]'); localStorage.setItem('mp_continue_watching', '[]'); setUser(null); setPassword(''); onSuccess?.(); }
          catch (reason) { setError(reason.message); }
          finally { setBusy(false); }
        }} style={{ marginTop: 24 }}>
          <p>Delete your account and its saved library. Confirm with your password.</p>
          <label htmlFor="delete-password">Confirm password</label>
          <input id="delete-password" className="form-input" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
          <button className="btn-secondary" disabled={busy}>Delete account</button>
        </form>
      </div> : <form onSubmit={submit}>
        <div className="auth-tabs-row">
          <button type="button" className="auth-tab-btn" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(null); }}>Sign in</button>
          <button type="button" className="auth-tab-btn" aria-pressed={mode === 'register'} onClick={() => { setMode('register'); setError(null); }}>Create account</button>
        </div>
        {mode === 'register' && <div className="form-group"><label htmlFor="account-name">Display name</label><input id="account-name" className="form-input" autoComplete="nickname" maxLength={80} value={name} onChange={event => setName(event.target.value)} /></div>}
        <div className="form-group"><label htmlFor="account-email">Email address</label><input id="account-email" className="form-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></div>
        <div className="form-group"><label htmlFor="account-password">Password</label><input id="account-password" className="form-input" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={12} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /><p>Use at least 12 characters.</p></div>
        <button className="btn-primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'register' ? 'Register' : 'Sign in'}</button>
      </form>}
      <div style={{ marginTop: 24 }}>
        <h3>Local device data</h3>
        <button className="btn-secondary" onClick={() => download({ country: api.getCountry(), watchlist: api.getWatchlist(), progress: api.getContinueWatching() })}>Export local data</button>
        {!user && <button className="btn-secondary" onClick={() => { localStorage.setItem('mp_watchlist', '[]'); localStorage.setItem('mp_continue_watching', '[]'); onSuccess?.(); }}>Clear local library</button>}
      </div>
    </div>
  </div>;
}
