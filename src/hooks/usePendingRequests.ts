import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '@/context/AuthContext'

/**
 * Returns the count of pending follow requests for the current user.
 * Used by the profile tab badge and the profile screen.
 */
export function usePendingRequests() {
  const { user } = useAuth()
  const [count, setCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); return }
    const { count: c } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id)
      .eq('status', 'pending')
    setCount(c ?? 0)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { count, refresh }
}
