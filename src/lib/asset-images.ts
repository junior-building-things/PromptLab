import type { AssetRecord } from './types';

/**
 * An image-reference asset can hold a whole set (a named bulk upload).
 * A batch has to treat each image as its own row, so the set is expanded
 * into entries that look exactly like single-image assets — same shape,
 * so row building, results, thumbnails and the HTML report need no
 * special case for grouped assets.
 *
 * Entry ids are `${assetId}#${index}`. A single-image asset keeps its
 * own id, which is what makes existing runs and their stored results
 * keep resolving after this change.
 */

const ENTRY_SEPARATOR = '#';

export function getAssetSources(asset: AssetRecord): string[] {
  if (asset.sources && asset.sources.length > 0) {
    return asset.sources;
  }

  return asset.source ? [asset.source] : [];
}

export function isGroupedAsset(asset: AssetRecord): boolean {
  return getAssetSources(asset).length > 1;
}

export function expandImageAsset(asset: AssetRecord): AssetRecord[] {
  const sources = getAssetSources(asset);
  if (sources.length <= 1) {
    return [asset];
  }

  return sources.map((source, index) => ({
    id: `${asset.id}${ENTRY_SEPARATOR}${index}`,
    name: `${asset.name} ${index + 1}`,
    kind: asset.kind,
    source,
    updatedAt: asset.updatedAt,
  }));
}

/** Resolve an id that may address a single asset or one image inside a
 * set. Used wherever a stored `assetId` is turned back into something
 * renderable — row labels, thumbnails, the downloadable report. */
export function resolveAssetEntry(
  assets: AssetRecord[],
  id?: string,
): AssetRecord | undefined {
  if (!id) return undefined;

  const direct = assets.find((asset) => asset.id === id);
  if (direct) return direct;

  const separatorIndex = id.lastIndexOf(ENTRY_SEPARATOR);
  if (separatorIndex === -1) return undefined;

  const parent = assets.find((asset) => asset.id === id.slice(0, separatorIndex));
  if (!parent) return undefined;

  const index = Number(id.slice(separatorIndex + 1));
  if (!Number.isInteger(index)) return undefined;

  return expandImageAsset(parent)[index];
}
