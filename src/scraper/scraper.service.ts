import { BadRequestException, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CheerioAPI, load } from 'cheerio';
import { Limiter } from '../utils/limiter';

/** Maximum concurrent outbound HTTP requests */
const MAX_CONCURRENCY = 2;

/** Allowed base hostname */
const ALLOWED_HOSTNAME = 'mdcomputers.in';

@Injectable()
export class ScraperService {
  private readonly client: AxiosInstance = axios.create({
    timeout: 15_000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      'Accept-Language': 'en-IN,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      Connection: 'keep-alive',
    },
  });

  private readonly limiter = new Limiter(MAX_CONCURRENCY);

  /**
   * Fetch an mdcomputers.in page and return a Cheerio-parsed DOM.
   */
  async fetchHtml(url: string): Promise<CheerioAPI> {
    this.assertAllowedUrl(url);
    return this.limiter.run(async () => {
      await this.jitter(1_000, 2_000);
      const response = await this.client.get<string>(url, {
        responseType: 'text',
      });
      return load(response.data);
    });
  }

  /**
   * Fetch multiple URLs concurrently (honours limiter concurrency cap).
   */
  async fetchMany(urls: string[]): Promise<CheerioAPI[]> {
    return Promise.all(urls.map((url) => this.fetchHtml(url)));
  }

  private assertAllowedUrl(url: string): void {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL provided.');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Only https:// URLs are allowed.');
    }

    if (!parsed.hostname.endsWith(ALLOWED_HOSTNAME)) {
      throw new BadRequestException(
        `Only ${ALLOWED_HOSTNAME} URLs are supported.`,
      );
    }
  }

  private jitter(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
}
