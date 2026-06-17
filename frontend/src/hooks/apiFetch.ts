import { useAdminStore } from '../stores/adminStore'

/**
 * Wrapper around fetch() that automatically adds the X-Admin-Key header
 * from the admin store. Use this for all admin REST API calls.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const adminKey = useAdminStore.getState().adminKey
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
    },
  })
}
