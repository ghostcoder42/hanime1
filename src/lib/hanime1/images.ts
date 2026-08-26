/**
 * Card-image geometry helpers.
 *
 * The CDN (`vdownload.hembed.com`) serves two card-image shapes and the shape
 * is encoded in the URL path:
 *
 *  - `/image/cover/{id}.jpg`      — portrait poster (2:3, ~268×394). Only the
 *    裏番 / 泡麵番 genre listings render these; every video of those genres
 *    reuses its series cover.
 *  - `/image/thumbnail/{id}l.jpg` — landscape video-frame preview (16:9,
 *    ~640×360). Served by the homepage feed and every non-裏番/泡麵番 listing
 *    (sort / tags / query searches, other genres, user pages). The watch page
 *    exposes the hi-res variant `/image/thumbnail/{id}h.jpg` as og:image.
 *
 * Every image URL is signed per path (`?secure=<md5>,<expiry>`) — a cover URL
 * cannot be rewritten into a landscape thumbnail URL, so a card must be laid
 * out in whatever orientation its scraped page served.
 */

/** The two card forms. Portrait ≈ 2:3 poster; landscape ≈ 16:9 preview. */
export type CardOrientation = 'portrait' | 'landscape';

/** Infer a card's orientation from its thumbnail URL (see module docs). */
export function cardOrientation(thumbnailUrl: string): CardOrientation {
  return thumbnailUrl.includes('/image/cover/') ? 'portrait' : 'landscape';
}
