/** An image the app can render can arrive in three shapes: a base64
 * data URL (legacy state + freshly read uploads), a provider URL, or a
 * `/api/images?id=…` reference into our own image store — which is what
 * everything persisted looks like since binary payloads were moved out
 * of the workspace JSON. */

const STORED_IMAGE_PREFIX = '/api/images?id=';

export function isStoredImage(value?: string): boolean {
  return Boolean(value?.startsWith(STORED_IMAGE_PREFIX));
}

export function isRenderableImage(value?: string): boolean {
  return Boolean(
    value && (/^data:image\//.test(value) || /^https?:\/\//.test(value) || isStoredImage(value)),
  );
}

/** Upload a base64 data URL to the image store and return the reference
 * URL to persist in its place. Falls back to the data URL when the
 * upload fails so the workspace keeps working (just heavier). */
export async function uploadImage(dataUrl: string): Promise<string> {
  try {
    const response = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ dataUrl }),
    });
    const payload = (await response.json()) as { url?: string };
    return response.ok && payload.url ? payload.url : dataUrl;
  } catch {
    return dataUrl;
  }
}

/** Inline a stored image as a data URL — used by the downloadable HTML
 * report, which has to work offline and off-origin. */
export async function toDataUrl(source: string): Promise<string> {
  if (!isStoredImage(source)) {
    return source;
  }

  try {
    const response = await fetch(source, { credentials: 'include' });
    if (!response.ok) return source;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return source;
  }
}
