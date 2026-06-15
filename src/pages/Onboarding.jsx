import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

export default function Onboarding() {
  const { refresh, user } = useApp()
  const [tab, setTab] = useState('create') // create | join
  const [hhName, setHhName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const create = async () => {
    setErr(null); setBusy(true)
    const { error } = await supabase.rpc('create_household', { p_name: hhName })
    setBusy(false)
    if (error) return setErr(error.message)
    refresh()
  }
  const join = async () => {
    setErr(null); setBusy(true)
    const { error } = await supabase.rpc('join_household', { p_code: code })
    setBusy(false)
    if (error) return setErr(error.message)
    refresh()
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-mark">👨‍👩‍👧‍👦</div>
        <h1 className="auth-title">כמעט שם</h1>
        <p className="auth-sub">
          שלום {user?.user_metadata?.display_name || ''}! צור משפחה חדשה, או הצטרף עם קוד שקיבלת.
        </p>

        <div className="seg">
          <button className={tab === 'create' ? 'on' : ''} onClick={() => setTab('create')}>משפחה חדשה</button>
          <button className={tab === 'join' ? 'on' : ''} onClick={() => setTab('join')}>הצטרפות</button>
        </div>

        {tab === 'create' ? (
          <>
            <label className="field">
              <span>שם המשפחה</span>
              <input value={hhName} onChange={(e) => setHhName(e.target.value)} placeholder="לדוגמה: משפחת וסרמן" />
            </label>
            <p className="muted small">תקבל קוד הצטרפות לשתף עם שאר בני הבית.</p>
            {err && <div className="alert">{err}</div>}
            <button className="btn primary block" disabled={busy} onClick={create}>
              {busy ? 'יוצר…' : 'יצירת המשפחה'}
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>קוד משפחה</span>
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" />
            </label>
            {err && <div className="alert">{err}</div>}
            <button className="btn primary block" disabled={busy} onClick={join}>
              {busy ? 'מצטרף…' : 'הצטרפות'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
