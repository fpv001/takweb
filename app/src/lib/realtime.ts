import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export type Notificacion = {
  id: string
  mensaje: string
  monto?: number
  created_at: string
}

// Hook para escuchar propinas nuevas en tiempo real
export function useRealtimePropinas(colaboradorId: string | null, onNuevaPropina: (monto: number) => void) {
  useEffect(() => {
    if (!colaboradorId) return

    const channel = supabase
      .channel(`propinas-${colaboradorId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'propinas',
          filter: `colaborador_id=eq.${colaboradorId}`,
        },
        (payload) => {
          const propina = payload.new as { monto_total: number }
          onNuevaPropina(propina.monto_total)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [colaboradorId])
}

// Hook para escuchar propinas nuevas de un hotel completo (para gerente)
export function useRealtimeHotel(hotelId: string | null, onNuevaPropina: (monto: number, colaboradorId: string) => void) {
  useEffect(() => {
    if (!hotelId) return

    const channel = supabase
      .channel(`hotel-${hotelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'propinas',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          const propina = payload.new as { monto_total: number; colaborador_id: string }
          onNuevaPropina(propina.monto_total, propina.colaborador_id)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [hotelId])
}
