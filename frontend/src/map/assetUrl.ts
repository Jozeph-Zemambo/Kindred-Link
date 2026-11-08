import { API_URL } from '@/api/config';

/**
 * The backend sends its own files as paths ("/api/photos/12", "/images/businesses/x.png").
 * The phone needs the full address, so prefix those with the backend's URL; full URLs pass through.
 */
export function assetUrl(url: string): string {
  return url.startsWith('/') ? `${API_URL}${url}` : url;
}
