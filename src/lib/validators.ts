export function isValidImageUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch (e) {
    // Permitir URLs relativas que comiencen con /
    if (url.startsWith('/')) {
      return true;
    }
    return false;
  }
}
