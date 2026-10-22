import { afterEach, describe, expect, it } from 'bun:test';
import { app } from '../index';

describe('Stage 2: YouTubeSearchService & GET /api/v1/search', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns SearchVideoItem[] with id, title, thumbnailUrl and returns cached: true on repeated query', async () => {
    let fetchCalls = 0;

    const mockInitialData = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: 'kJQP7kiw5Fk',
                          title: { runs: [{ text: 'MrBeast $1 vs $1,000,000 Challenge' }] },
                          ownerText: { runs: [{ text: 'MrBeast' }] },
                          thumbnail: {
                            thumbnails: [{ url: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' }],
                          },
                          lengthText: { simpleText: '14:20' },
                          publishedTimeText: { simpleText: '2 days ago' },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(
        `<script>var ytInitialData = ${JSON.stringify(mockInitialData)};</script>`,
        { status: 200 }
      );
    }) as typeof fetch;

    // First request -> cache miss (cached: false)
    const res1 = await app.request('/api/v1/search?q=mrbeast');
    expect(res1.status).toBe(200);
    const body1: any = await res1.json();

    expect(body1.cached).toBe(false);
    expect(body1.items).toHaveLength(1);
    expect(body1.items[0]).toMatchObject({
      id: 'kJQP7kiw5Fk',
      title: 'MrBeast $1 vs $1,000,000 Challenge',
      channelTitle: 'MrBeast',
      thumbnailUrl: 'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
      duration: '14:20',
      hasCaptions: true,
    });
    expect(fetchCalls).toBe(1);

    // Second request -> cache hit (cached: true) without hitting external fetch again
    const res2 = await app.request('/api/v1/search?q=mrbeast');
    expect(res2.status).toBe(200);
    const body2: any = await res2.json();

    expect(body2.cached).toBe(true);
    expect(body2.items).toHaveLength(1);
    expect(body2.items[0].id).toBe('kJQP7kiw5Fk');
    expect(fetchCalls).toBe(1);
  });
});
