import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null); setHousehold(null); setMembers([])
      return
    }
    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(prof || null)

    if (prof?.household_id) {
      const { data: hh } = await supabase
        .from('households').select('*').eq('id', prof.household_id).maybeSingle()
      setHousehold(hh || null)
      const { data: mem } = await supabase
        .from('profiles').select('*').eq('household_id', prof.household_id)
        .order('role', { ascending: true }).order('display_name', { ascending: true })
      setMembers(mem || [])
    } else {
      setHousehold(null); setMembers([])
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadProfile(session?.user?.id)
  }, [session, loadProfile])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    loadProfile(session?.user?.id)
  }, [session, loadProfile])

  // סנכרון חי של בני המשפחה
  useEffect(() => {
    if (!profile?.household_id) return
    const ch = supabase
      .channel('members')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `household_id=eq.${profile.household_id}` },
        () => refresh())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [profile?.household_id, refresh])

  const value = { session, loading, profile, household, members, refresh, user: session?.user || null }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
