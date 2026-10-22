import { SearchVideoItem, SearchResponse } from '@learneng/shared';

export class YouTubeSearchService {
  private cache = new Map<string, { data: SearchVideoItem[]; expiresAt: number }>();

  async search(query: string, apiKey?: string): Promise<SearchResponse> {
    const normalizedQuery = query.trim().toLowerCase();
    const now = Date.now();

    // 1. Sprawdź pamięć podręczną (24h cache)
    const cached = this.cache.get(normalizedQuery);
    if (cached && cached.expiresAt > now) {
      return { query, items: cached.data, cached: true };
    }

    // 2. Jeśli podano klucz API -> użyj oficjalnego YouTube Data API v3
    if (apiKey) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
            query
          )}&type=video&videoCaption=closedCaption&maxResults=20&key=${apiKey}`
        );
        if (res.ok) {
          const json: any = await res.json();
          const items: SearchVideoItem[] = (json.items || []).map((item: any) => ({
            id: item.id.videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl:
              item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
            publishedAt: item.snippet.publishedAt,
            hasCaptions: true,
          }));

          this.cache.set(normalizedQuery, { data: items, expiresAt: now + 24 * 3600 * 1000 });
          return { query, items, cached: false };
        }
      } catch (err) {
        console.warn('YouTube API search failed, falling back to scraper:', err);
      }
    }

    // 3. Fallback scraper wyników wyszukiwania (bez limitów API)
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();
    const initialDataMatch = html.match(/var ytInitialData\s*=\s*({.+?});(?:var|\s*<\/script>)/s);
    if (!initialDataMatch) {
      return { query, items: [], cached: false };
    }

    const data = JSON.parse(initialDataMatch[1]);
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents?.[0]?.itemSectionRenderer?.contents || [];

    const items: SearchVideoItem[] = [];

    for (const item of contents) {
      const v = item.videoRenderer;
      if (!v || !v.videoId) continue;

      items.push({
        id: v.videoId,
        title: v.title?.runs?.[0]?.text || 'Bez tytułu',
        channelTitle: v.ownerText?.runs?.[0]?.text || '',
        thumbnailUrl:
          v.thumbnail?.thumbnails?.[0]?.url ||
          `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        duration: v.lengthText?.simpleText || '',
        publishedAt: v.publishedTimeText?.simpleText || '',
        hasCaptions: true,
      });

      if (items.length >= 20) break;
    }

    this.cache.set(normalizedQuery, { data: items, expiresAt: now + 24 * 3600 * 1000 });
    return { query, items, cached: false };
  }
}
