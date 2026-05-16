import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const EXPIRY_MINUTES = 45
const VOTED_KEY = 'splitpromet_voted'

function loadVoted() {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) || '[]')) }
  catch { return new Set() }
}

function saveVoted(set) {
  localStorage.setItem(VOTED_KEY, JSON.stringify([...set]))
}

export function useReports() {
  const [reports, setReports] = useState([])
  const [voted, setVoted] = useState(loadVoted)

  const fetchReports = useCallback(async () => {
    if (!supabase) return
    try {
      const since = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
      if (!error && data) setReports(data)
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchReports()
    if (!supabase) return

    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchReports)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchReports])

  const addReport = useCallback(async ({ lat, lng, type, location, severity, summary }) => {
    if (!supabase) return { data: null, error: new Error('Supabase nije konfiguriran') }
    const { data, error } = await supabase
      .from('reports')
      .insert([{ lat, lng, type, location, severity, summary, votes: 1 }])
      .select()
      .single()
    if (!error && data) setReports(prev => [data, ...prev])
    return { data, error }
  }, [])

  const upvoteReport = useCallback(async (id) => {
    if (!supabase) return
    const report = reports.find(r => r.id === id)
    if (!report) return
    await supabase.from('reports').update({ votes: report.votes + 1 }).eq('id', id)
    setReports(prev => prev.map(r => r.id === id ? { ...r, votes: r.votes + 1 } : r))
  }, [reports, voted])

  return { reports, addReport, upvoteReport }
}
