import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const EXPIRY_MINUTES = 45

export function useReports() {
  const [reports, setReports] = useState([])

  const fetchReports = useCallback(async () => {
    const since = new Date(Date.now() - EXPIRY_MINUTES * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })

    if (!error && data) setReports(data)
  }, [])

  useEffect(() => {
    fetchReports()

    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchReports)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchReports])

  const addReport = useCallback(async ({ lat, lng, type, location, severity, summary }) => {
    const { data, error } = await supabase.from('reports').insert([
      { lat, lng, type, location, severity, summary, votes: 1 }
    ]).select().single()

    if (!error && data) setReports(prev => [data, ...prev])
    return { data, error }
  }, [])

  const upvoteReport = useCallback(async (id) => {
    const report = reports.find(r => r.id === id)
    if (!report) return
    await supabase
      .from('reports')
      .update({ votes: report.votes + 1 })
      .eq('id', id)

    setReports(prev => prev.map(r => r.id === id ? { ...r, votes: r.votes + 1 } : r))
  }, [reports])

  return { reports, addReport, upvoteReport, refresh: fetchReports }
}
