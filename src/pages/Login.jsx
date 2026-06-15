import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  const submit = async () => {
    setErr(null); setMsg(null); setBusy(true)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: name } },
        })
        if (error) throw error
        setMsg('נרשמת! אם נדרש אימות מייל — אשר אותו ואז התחבר.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setErr(translate(e.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-mark">🍽️</div>
        <h1 className="auth-title">מה אוכלים <em>השבוע</em></h1>
        <p className="auth-sub">תכנון ארוחות, בישולים וקניות — לכל המשפחה.</p>

        <div className="seg">
          <button className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>כניסה</button>
          <button className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>הרשמה</button>
        </div>

        {mode === 'signup' && (
          <label className="field">
            <span>השם שלי</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="איך לקרוא לך?" />
          </label>
        )}
        <label className="field">
          <span>אימייל</span>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </label>
        <label className="field">
          <span>סיסמה</span>
          <input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="לפחות 6 תווים" />
        </label>

        {err && <div className="alert">{err}</div>}
        {msg && <div className="note">{msg}</div>}

        <button className="btn primary block" disabled={busy} onClick={submit}>
          {busy ? 'רגע…' : mode === 'signup' ? 'יצירת חשבון' : 'כניסה'}
        </button>
      </div>
    </div>
  )
}

function translate(m = '') {
  if (m.includes('Invalid login')) return 'אימייל או סיסמה שגויים.'
  if (m.includes('already registered')) return 'האימייל כבר רשום. נסה להתחבר.'
  if (m.includes('at least 6')) return 'הסיסמה צריכה לפחות 6 תווים.'
  return m
}
