import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { COLORS, Icon, Input, Btn } from '../components/ui';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode]   = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await API.post('/auth/login', { username, password, mfa_code: mfaCode || undefined });
      if (res.data.mfa_required) { setMfaRequired(true); setLoading(false); return; }
      login(res.data.token, res.data.user);
      navigate(res.data.user.role === 'Admin' ? '/dashboard' : '/sales');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: COLORS.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 420, animation: 'fadeIn 0.5s ease' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, background: `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.cyan})`, borderRadius: 18, marginBottom: 18 }}>
            <Icon name="stores" size={32} />
          </div>
          <h1 style={{ color: COLORS.text, fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", margin: 0 }}>TrendMart Login</h1>
          <p style={{ color: COLORS.dim, fontSize: 13, marginTop: 6 }}>Smart Retail Sales Analytics System</p>
        </div>

        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28 }}>
          {error && (
            <div style={{ background: COLORS.rose + '18', border: `1px solid ${COLORS.rose}40`, color: COLORS.rose, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {mfaRequired && (
            <div style={{ marginBottom: 14 }}>
              <Input placeholder="6-digit MFA code" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} required />
            </div>
          )}

          <Btn type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
            {loading ? 'Signing in...' : mfaRequired ? 'Verify & Sign In' : 'Sign In'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
