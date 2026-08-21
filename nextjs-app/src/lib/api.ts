export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/timesweet')) {
    if (!cleanPath.startsWith('/timesweet')) {
      return `/timesweet${cleanPath}`;
    }
  }

  return cleanPath;
}
