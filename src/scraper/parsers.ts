import { CheerioAPI } from 'cheerio';
import {
  parsePriceInr,
  normalizeStockStatus,
  canonicalizeSpecKey,
} from '../utils/normalize';
import { resolveProductUrl, BASE_URL } from './url-builder';

// ─── Shared types ─────────────────────────────────────────────────────────────

export type ProductSummary = {
  name: string;
  price: number | null;
  currency: 'INR';
  in_stock: boolean;
  brand: string | null;
  category: string | null;
  url: string;
  thumbnail_url: string | null;
};

export type ProductDetail = ProductSummary & {
  specs: Record<string, string>;
  description: string | null;
  warranty: string | null;
  rating: number | null;
  review_count: number | null;
};

// ─── Listing-page parser ───────────────────────────────────────────────────────

/**
 * Parse a Magento-style product listing page (category or search results).
 * Tries the most common Magento 1/2 CSS selectors with fallbacks.
 */
export const parseListingPage = (
  $: CheerioAPI,
  category: string | null = null,
): ProductSummary[] => {
  const products: ProductSummary[] = [];

  // Magento 2 uses <li class="item product product-item">
  // Magento 1 uses <li class="item">
  const $items = $(
    'li.product-item, li.item.product, li.item[class], .products-grid .item',
  ).filter((_, el) => {
    const text = $(el).find('a').first().attr('href') ?? '';
    return text.length > 0;
  });

  $items.each((_, el) => {
    const $el = $(el);

    // ── Name ──
    const name = (
      $el.find('.product-item-name, .product-name h2, .product-name').text() ||
      $el
        .find('a.product-item-link, a.product-name, .product-item-name a')
        .first()
        .text()
    ).trim();
    if (!name) return;

    // ── URL ──
    const href =
      $el
        .find(
          'a.product-item-link, .product-item-name a, a.product-name, a[title]',
        )
        .first()
        .attr('href') ?? '';
    const url = resolveProductUrl(href);

    // ── Price ──
    const priceText = $el
      .find('.price-box .price, .price')
      .first()
      .text()
      .trim();
    const price = parsePriceInr(priceText);

    // ── Stock ──
    const fullText = $el.text();
    const in_stock = /out\s*of\s*stock/i.test(fullText)
      ? false
      : normalizeStockStatus($el.find('.stock, .availability').text()) ||
        price !== null;

    // ── Brand ──
    const brand =
      $el.find('[data-brand], .brand, .manufacturer').first().text().trim() ||
      null;

    // ── Thumbnail ──
    const thumbnail_url =
      $el
        .find('img.product-image-photo, img.product-image, .product-image img')
        .attr('src') ?? null;

    products.push({
      name,
      price,
      currency: 'INR',
      in_stock,
      brand,
      category,
      url,
      thumbnail_url,
    });
  });

  return products;
};

// ─── Detail-page parser ────────────────────────────────────────────────────────

/**
 * Parse a Magento-style product detail page.
 */
export const parseProductDetail = (
  $: CheerioAPI,
  url: string,
): ProductDetail => {
  // ── Name ──
  const name =
    $(
      'h1.page-title .base, h1.page-title, h1.product-name, .product-info-main h1',
    )
      .first()
      .text()
      .trim() ||
    $('h1').first().text().trim() ||
    '';

  // ── Price ──
  const priceText = $(
    '.product-info-price .price, .price-box .price, .regular-price .price, .special-price .price',
  )
    .first()
    .text()
    .trim();
  const price = parsePriceInr(priceText);

  // ── Stock ──
  const stockEl = $(
    '.stock.available, .in-stock, .stock span, .availability span',
  );
  const hasOutOfStock = /out\s*of\s*stock/i.test(
    $('.stock, .availability').text(),
  );
  const in_stock = hasOutOfStock
    ? false
    : normalizeStockStatus(stockEl.text()) || price !== null;

  // ── Brand ──
  const brand =
    $('[itemprop="brand"], .product-brand, .brand-name')
      .first()
      .text()
      .trim() || null;

  // ── Thumbnail ──
  const thumbnail_url =
    $(
      'img.gallery-placeholder__image, img.product-image-photo, .product.media img, .product-image-container img',
    )
      .first()
      .attr('src') ?? null;

  // ── Specs ──
  const specs: Record<string, string> = {};

  // Table pattern (most common)
  $(
    '#product-attribute-specs-table tr, .product.attribute.specification tr, .specification-table tr, .spec-table tr, table.data tr',
  ).each((_, row) => {
    const cells = $(row).find('th, td');
    if (cells.length >= 2) {
      const rawKey = $(cells[0]).text().trim();
      const val = $(cells[1]).text().trim();
      if (rawKey && val) {
        specs[canonicalizeSpecKey(rawKey)] = val;
      }
    }
  });

  // dl/dt/dd fallback
  $(
    '.product.attribute.specification dl, .specifications dl, .product-attribute dl',
  ).each((_, dl) => {
    $(dl)
      .find('dt')
      .each((_, dt) => {
        const rawKey = $(dt).text().trim();
        const val = $(dt).next('dd').text().trim();
        if (rawKey && val) {
          specs[canonicalizeSpecKey(rawKey)] = val;
        }
      });
  });

  // ── Description ──
  const description =
    $(
      '.product.attribute.description .value, #description .value, .short-description .value, .product-description',
    )
      .first()
      .text()
      .trim() || null;

  // ── Warranty ──
  const warranty = extractWarranty(specs, description);

  // ── Rating (star percentage → 1–5 scale) ──
  const ratingStyle =
    $('[class*="rating-percent"], .rating-percent').attr('style') ?? '';
  const ratingMatch = ratingStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
  const rating = ratingMatch
    ? Math.round((Number(ratingMatch[1]) / 20) * 10) / 10
    : null;

  // ── Review count ──
  const reviewText = $(
    '[class*="reviews-count"], .reviews-count, .review-count, .reviews-actions',
  )
    .first()
    .text()
    .trim();
  const reviewMatch = reviewText.match(/(\d+)/);
  const review_count = reviewMatch ? parseInt(reviewMatch[1], 10) : null;

  return {
    name,
    price,
    currency: 'INR',
    in_stock,
    brand,
    category: null,
    url,
    thumbnail_url,
    specs,
    description,
    warranty,
    rating,
    review_count,
  };
};

// ─── Pagination count ──────────────────────────────────────────────────────────

/**
 * Extract the total product count from a listing page toolbar.
 */
export const parseTotalCount = ($: CheerioAPI): number | null => {
  // Magento 2: "Items 1-12 of 47" inside .toolbar-amount
  // Magento 1: similar pattern in .toolbar .showing
  const text = $('.toolbar-amount, .toolbar-number, .showing').text();
  const match = text.match(/of\s+([\d,]+)/i) ?? text.match(/(\d[\d,]*)/);
  if (!match) return null;
  return parseInt(match[1].replace(/,/g, ''), 10);
};

// ─── Internal helpers ──────────────────────────────────────────────────────────

function extractWarranty(
  specs: Record<string, string>,
  description: string | null,
): string | null {
  // Check if warranty appears as a spec key
  for (const key of Object.keys(specs)) {
    if (/warranty/i.test(key)) return specs[key];
  }
  // Fallback: scan description text
  if (description) {
    const match = description.match(/(\d+[\s-]?year[s]?\s+warranty)/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Build a fully-qualified mdcomputers.in URL from a relative path.
 * Re-exported for convenience so callers only need to import from parsers.
 */
export { BASE_URL };
