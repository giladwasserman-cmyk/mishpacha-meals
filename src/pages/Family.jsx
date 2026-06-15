import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { PALETTE } from '../lib/constants'

export default function Family() {
  const { profile, household, members, refresh } = useApp()
  const isParent = profile.role === 'parent'
  const [copied, setCopied] = useState(false)

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(household.join_code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }

  const update = async (id, patch) => {
    await supabase.from('profiles').update(patch).eq('id', id)
    refresh()
  }

  return (
    <div className="page">
      <div className="page-head"><h1>המשפחה</h1></div>

      <div className="hh-card">
        <div className="muted small">שם המשפחה</div>
        <div className="hh-name">{household.name}</div>
        <div className="join-row">
          <div>
            <div className="muted small">קוד הצטרפות</div>
            <div className="join-code" dir="ltr">{household.join_code}</div>
          </div>
          <button className="btn ghost sm" onClick={copyCode}>{copied ? 'הועתק ✓' : 'העתק'}</button>
        </div>
        <p className="muted small">שתף את הקוד עם בני הבית — כל אחד נרשם ומזין אותו בהצטרפות.</p>
      </div>

      <div className="members">
        {members.map((m) => {
          const editable = m.id === profile.id || isParent
          return (
            <div className="member" key={m.id}>
              <div className="member-top">
                <span className="avatar" style={{ background: m.color }}>{(m.display_name || '?').charAt(0)}</span>
                <div className="member-id">
                  {editable ? (
                    <input className="name-input" value={m.display_name || ''}
                      placeholder="שם" onChange={(e) => update(m.id, { display_name: e.target.value })} />
                  ) : <strong>{m.display_name || 'בלי שם'}</strong>}
                  <span className="role-tag">{m.role === 'parent' ? 'הורה' : 'ילד/ה'}{m.id === profile.id ? ' · אני' : ''}</span>
                </div>
              </div>
              {editable && (
                <div className="member-edit">
                  <div className="swatches">
                    {PALETTE.map((c) => (
                      <button key={c} className={'swatch' + (m.color === c ? ' on' : '')}
                        style={{ background: c }} onClick={() => update(m.id, { color: c })} aria-label="צבע" />
                    ))}
                  </div>
                  {isParent && m.id !== profile.id && (
                    <button className="link" onClick={() => update(m.id, { role: m.role === 'parent' ? 'kid' : 'parent' })}>
                      הפוך ל{m.role === 'parent' ? 'ילד/ה' : 'הורה'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
