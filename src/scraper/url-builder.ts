import { BrowseCategoryArgs } from '../tools/tools.service';

export const BASE_URL = 'https://mdcomputers.in';

const SORT_MAP: Record<
  NonNullable<BrowseCategoryArgs['sort']>,
  { order: string; dir: string }
> = {
  price_asc: { order: 'price', dir: 'asc' },
  price_desc: { order: 'price', dir: 'desc' },
  name: { order: 'name', dir: 'asc' },
  newest: { order: 'created_at', dir: 'desc' },
};

/**
 * Global keyword search URL.
 * https://mdcomputers.in/catalogsearch/result/?q={query}
 */
export const buildSearchUrl = (query: string): string => {
  const url = new URL(`${BASE_URL}/catalogsearch/result/`);
  url.searchParams.set('q', query);
  return url.toString();
};

/**
 * Category page with an inline keyword filter.
 * https://mdcomputers.in/{category}?q={query}
 */
export const buildCategorySearchUrl = (
  category: string,
  query: string,
): string => {
  const url = new URL(`${BASE_URL}/${category}`);
  url.searchParams.set('q', query);
  return url.toString();
};

/**
 * Paginated / filtered category browse URL.
 * https://mdcomputers.in/{category}?p=2&product_list_order=price&product_list_dir=asc&…
 */
export const buildCategoryUrl = (args: BrowseCategoryArgs): string => {
  const url = new URL(`${BASE_URL}/${args.category}`);

  if (args.page && args.page > 1) {
    url.searchParams.set('p', String(args.page));
  }

  if (args.sort) {
    const { order, dir } = SORT_MAP[args.sort];
    url.searchParams.set('product_list_order', order);
    url.searchParams.set('product_list_dir', dir);
  }

  if (args.brand) {
    url.searchParams.set('brand', args.brand);
  }

  if (args.min_price != null || args.max_price != null) {
    const min = args.min_price ?? 0;
    const max = args.max_price ?? '';
    url.searchParams.set('price', `${min}-${max}`);
  }

  return url.toString();
};

/**
 * Resolve a potentially relative product URL against the base.
 */
export const resolveProductUrl = (href: string): string => {
  if (!href) return '';
  try {
    return new URL(href, BASE_URL).toString();
  } catch {
    return href;
  }
};
