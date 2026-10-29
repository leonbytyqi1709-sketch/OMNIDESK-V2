import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useApiFetch } from '@/hooks/use-api'
import { SEARCH_MIN_LENGTH, type SearchHit } from '@/lib/search'

/**
 * Verzögert den Suchbegriff, damit beim Tippen nicht jede Taste eine Anfrage
 * auslöst. 200 ms sind kurz genug, um sofort zu wirken.
 */
export function useDebounced(value: string, delay = 200) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

/** Suche über alle Module. Läuft erst ab zwei Zeichen und nur bei offener Palette. */
export function useGlobalSearch(term: string, enabled: boolean) {
  const apiFetch = useApiFetch()
  const trimmed = term.trim()
  return useQuery({
    queryKey: ['search', trimmed],
    queryFn: () => apiFetch<SearchHit[]>(`/api/search?q=${encodeURIComponent(trimmed)}`),
    enabled: enabled && trimmed.length >= SEARCH_MIN_LENGTH,
    staleTime: 30_000,
  })
}
