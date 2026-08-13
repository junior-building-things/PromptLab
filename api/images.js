import { readSession } from './_lib/auth.js';
import { readImage, saveImage } from './_lib/store.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function normalizeBody(req) {
  if (!req.body) return null;
  if (typeof req.body === 'string') {
    return JSON.parse(req.body);
  }
  return req.body;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Binary side-channel for the workspace. Generated outputs and uploaded
 * reference images are stored here rather than inline in the state JSON
 * — see the note on `isStoredImageUrl` in `_lib/store.js`.
 *
 *   GET  /api/images?id=img_…   → the raw bytes (own images only)
 *   POST /api/images { dataUrl } → { url } to persist in place of it
 */
export default async function handler(req, res) {
  const user = readSession(req);
  if (!user) {
    return json(res, 401, { error: 'Authentication required.' });
  }

  try {
    if (req.method === 'GET') {
      const id = first(req.query?.id);
      if (!id) {
        return json(res, 400, { error: 'Missing image id.' });
      }

      const image = await readImage(user, id);
      if (!image) {
        return json(res, 404, { error: 'Image not found.' });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', image.mimeType);
      // Stored images are immutable — the id is minted per upload.
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
      return res.end(image.bytes);
    }

    if (req.method === 'POST') {
      const body = normalizeBody(req);
      const url = await saveImage(user, body?.dataUrl);
      if (!url) {
        return json(res, 400, { error: 'Expected a base64 image data URL.' });
      }

      return json(res, 200, { url });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Image request failed unexpectedly.',
    });
  }
}
