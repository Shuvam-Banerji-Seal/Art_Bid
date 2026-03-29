const API_BASE = import.meta.env.VITE_API_URL || '/api';

function getApiOrigin() {
  if (typeof window === 'undefined') return '';
  try {
    return new URL(API_BASE, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
}

export function resolveImageUrl(rawUrl) {
  if (!rawUrl) return rawUrl;

  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) {
    return rawUrl;
  }

  if (rawUrl.startsWith('/api/') || rawUrl.startsWith('/uploads/')) {
    const origin = getApiOrigin();
    return origin ? `${origin}${rawUrl}` : rawUrl;
  }

  return rawUrl;
}
