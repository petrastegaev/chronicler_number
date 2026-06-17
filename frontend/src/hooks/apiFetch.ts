import { useAdminStore } from '../stores/adminStore'

/**
 * Normalize HeadersInit to a plain object for safe spreading.
 * Headers instances have no own enumerable properties, so {...headers} === {}.
 */
function headersToObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    const obj: Record<string, string> = {}
    headers.forEach((value, key) => { obj[key] = value })
    return obj
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return headers
}

/**
 * Wrapper around fetch() that automatically adds the X-Admin-Key header
 * from the admin store. Use this for all admin REST API calls.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const adminKey = useAdminStore.getState().adminKey
  return fetch(url, {
    ...options,
    headers: {
      ...headersToObject(options.headers),
      ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
    },
  })
}
