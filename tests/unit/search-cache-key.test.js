const { EventEmitter } = require('events');
const IntelligentCache = require('../../middleware/intelligent-cache');

function mockRes() {
  const res = new EventEmitter();
  res.headers = {};
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

function mockReq(body) {
  return {
    method: 'POST',
    path: '/api/hubspot/search/contacts',
    query: {},
    body
  };
}

describe('search cache identity', () => {
  test('body digest separates different POST searches and repeats an identical one', () => {
    const cache = new IntelligentCache({ cleanupInterval: 600000 });
    const middleware = cache.middleware({
      ttl: 120000,
      skipCache: (req) => req.method !== 'POST',
      keyGenerator: (req) => IntelligentCache.requestCacheKey(req, { includeBody: true })
    });

    const first = mockRes();
    let downstream = 0;
    middleware(mockReq({ query: 'ada' }), first, () => {
      downstream += 1;
      first.json({ results: ['ada'] });
    });

    const second = mockRes();
    middleware(mockReq({ query: 'grace' }), second, () => {
      downstream += 1;
      second.json({ results: ['grace'] });
    });

    const repeat = mockRes();
    middleware(mockReq({ query: 'ada' }), repeat, () => {
      downstream += 1;
      repeat.json({ results: ['should-not-run'] });
    });

    expect(downstream).toBe(2);
    expect(first.body).toEqual({ results: ['ada'] });
    expect(second.body).toEqual({ results: ['grace'] });
    expect(repeat.headers['X-Cache']).toBe('HIT');
    expect(repeat.body).toEqual({ results: ['ada'] });
  });

  test('default key still ignores body so GET contact caching is unchanged', () => {
    const withAda = IntelligentCache.requestCacheKey(mockReq({ query: 'ada' }));
    const withGrace = IntelligentCache.requestCacheKey(mockReq({ query: 'grace' }));
    expect(withAda).toBe(withGrace);
    expect(withAda).not.toMatch(/ada|grace/);
  });
});
