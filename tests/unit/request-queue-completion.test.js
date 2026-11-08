const { EventEmitter } = require('events');
const RequestQueue = require('../../middleware/request-queue');

function mockReq() {
  const req = new EventEmitter();
  req.path = '/api/example';
  req.method = 'GET';
  return req;
}

function mockRes() {
  const res = new EventEmitter();
  res.headersSent = false;
  res.writableEnded = false;
  res.finished = false;
  res.statusCode = 200;
  res.body = null;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  res.send = (data) => {
    res.body = data;
    return res;
  };
  return res;
}

function createQueue() {
  return new RequestQueue({
    maxConcurrent: 1,
    baseTimeout: 1000,
    minTimeout: 1000,
    maxTimeout: 5000
  });
}

describe('request queue completion', () => {
  test('finish and close release one slot and start one waiter', async () => {
    const queue = createQueue();
    const middleware = queue.middleware();
    const started = [];

    const req1 = mockReq();
    const res1 = mockRes();
    const req2 = mockReq();
    const res2 = mockRes();

    middleware(req1, res1, () => started.push('first'));
    middleware(req2, res2, () => started.push('second'));

    expect(started).toEqual(['first']);
    expect(queue.activeRequests).toBe(1);
    expect(queue.queue).toHaveLength(1);

    res1.emit('finish');
    res1.emit('close');
    res1.emit('error', new Error('late'));

    await new Promise((resolve) => setImmediate(resolve));

    expect(started).toEqual(['first', 'second']);
    expect(queue.activeRequests).toBe(1);
    expect(queue.queue).toHaveLength(0);
  });

  test('a closed waiter leaves the queue and is not started later', async () => {
    const queue = createQueue();
    const middleware = queue.middleware();
    const started = [];

    const req1 = mockReq();
    const res1 = mockRes();
    const req2 = mockReq();
    const res2 = mockRes();

    middleware(req1, res1, () => started.push('first'));
    middleware(req2, res2, () => started.push('second'));
    req2.emit('close');

    expect(queue.queue).toHaveLength(0);

    res1.emit('finish');
    await new Promise((resolve) => setImmediate(resolve));

    expect(started).toEqual(['first']);
    expect(queue.activeRequests).toBe(0);
    expect(res2.statusCode).toBe(200);
    expect(res2.body).toBeNull();
  });

  test('a queued request times out once', () => {
    jest.useFakeTimers();
    const queue = createQueue();
    const middleware = queue.middleware();
    const req1 = mockReq();
    const res1 = mockRes();
    const req2 = mockReq();
    const res2 = mockRes();

    middleware(req1, res1, () => {});
    middleware(req2, res2, () => {});

    jest.advanceTimersByTime(5000);

    expect(queue.queue).toHaveLength(0);
    expect(res2.statusCode).toBe(503);
    expect(res2.body).toEqual(expect.objectContaining({
      success: false,
      error: 'Request timeout in queue'
    }));

    jest.useRealTimers();
  });
});
