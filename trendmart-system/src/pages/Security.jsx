import { useState } from 'react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { COLORS, Icon, Btn, Input, Field, Badge, Toast } from '../components/ui';

export default function Security() {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState('idle'); // idle | setup | verifying
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const beginSetup = async () => {
    setError(null);
    try {
      const res = await API.post('/auth/mfa/setup');
      setQrCode(res.data.qr_code);
      setSecret(res.data.secret);
      setStep('setup');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start MFA setup.');
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await API.post('/auth/mfa/verify', { mfa_code: code });
      updateUser({ mfa_enabled: true });
      setStep('idle');
      setCode('');
      setToast({ msg: 'MFA activated successfully.', type: 'success' });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    }
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ color: COLORS.text, fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Security Settings</h1>

      <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <span style={{ color: user.mfa_enabled ? COLORS.emerald : COLORS.dim, background: (user.mfa_enabled ? COLORS.emerald : COLORS.dim) + '18', padding: 10, borderRadius: 10 }}>
            <Icon name="security" size={20} />
          </span>
          <div>
            <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 15 }}>Multi-Factor Authentication</div>
            <Badge color={user.mfa_enabled ? COLORS.emerald : COLORS.dim}>{user.mfa_enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>
        </div>

        {user.mfa_enabled ? (
          <p style={{ color: COLORS.muted, fontSize: 13 }}>
            MFA is active on your account. You'll be asked for a 6-digit code from your authenticator app every time you log in, in addition to your password.
          </p>
        ) : step === 'idle' ? (
          <>
            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>
              Add an extra layer of protection to your account. Once enabled, logging in will require a time-based code from an authenticator app (e.g. Google Authenticator, Aegis, FreeOTP) in addition to your password.
            </p>
            <Btn onClick={beginSetup}>Enable MFA</Btn>
          </>
        ) : (
          <form onSubmit={verify}>
            {error && (
              <div style={{ background: COLORS.rose + '18', border: `1px solid ${COLORS.rose}40`, color: COLORS.rose, fontSize: 13, padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 12 }}>
              Scan this QR code with your authenticator app:
            </p>
            <img src={qrCode} alt="MFA QR Code" style={{ display: 'block', margin: '0 auto 16px', borderRadius: 8, background: '#fff', padding: 8 }} />

            <p style={{ color: COLORS.dim, fontSize: 12, marginBottom: 4 }}>Can't scan? Enter this key manually instead:</p>
            <code style={{ display: 'block', color: COLORS.cyan, background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 12, marginBottom: 20, wordBreak: 'break-all' }}>
              {secret}
            </code>

            <Field label="Enter the 6-digit code from your app" required>
              <Input required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
            </Field>

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn type="submit" variant="success">Verify & Activate</Btn>
              <Btn type="button" variant="ghost" onClick={() => { setStep('idle'); setError(null); }}>Cancel</Btn>
            </div>
          </form>
        )}
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}