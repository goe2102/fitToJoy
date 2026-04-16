import { supabase } from '../../lib/supabase'
import { blockService } from './blockService'
import type { ReportReason } from '../types'

export const reportService = {
  async submit(reporterId: string, reportedId: string, reason: ReportReason, description?: string) {
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: reporterId, reported_id: reportedId, reason, description: description || null })
    if (!error) {
      // Reporting always implies blocking — fire-and-forget
      await blockService.block(reporterId, reportedId)
    }
    return { error }
  },

  async hasReported(reporterId: string, reportedId: string): Promise<boolean> {
    const { data } = await supabase
      .from('reports')
      .select('reporter_id')
      .eq('reporter_id', reporterId)
      .eq('reported_id', reportedId)
      .maybeSingle()
    return !!data
  },
}
