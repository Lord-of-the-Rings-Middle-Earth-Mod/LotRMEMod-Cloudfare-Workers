import { vi } from 'vitest';

// Mock Cloudflare's SELF for testing
global.SELF = {
  fetch: vi.fn()
};

// Mock Response and Request constructors
global.Response = class MockResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.statusText = init.statusText || 'OK';
    this.headers = new Map(Object.entries(init.headers || {}));
    this._bodyUsed = false;
  }

  async text() {
    if (this._bodyUsed) throw new Error('Body has already been consumed');
    this._bodyUsed = true;
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }

  async json() {
    if (this._bodyUsed) throw new Error('Body has already been consumed');
    this._bodyUsed = true;
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }
};

global.Request = class MockRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this.body = init.body;
    this._bodyUsed = false;
  }

  async json() {
    if (this._bodyUsed) throw new Error('Body has already been consumed');
    this._bodyUsed = true;
    return typeof this.body === 'string' ? JSON.parse(this.body) : this.body;
  }

  async text() {
    if (this._bodyUsed) throw new Error('Body has already been consumed');
    this._bodyUsed = true;
    return typeof this.body === 'string' ? this.body : JSON.stringify(this.body);
  }
};

// Mock URL constructor
global.URL = class MockURL {
  constructor(url, base) {
    const fullUrl = base ? new globalThis.URL(url, base) : new globalThis.URL(url);
    this.href = fullUrl.href;
    this.pathname = fullUrl.pathname;
    this.search = fullUrl.search;
    this.searchParams = fullUrl.searchParams;
    this.host = fullUrl.host;
    this.hostname = fullUrl.hostname;
    this.port = fullUrl.port;
    this.protocol = fullUrl.protocol;
  }
};

// Setup default mocks that can be overridden in individual tests
beforeEach(() => {
  vi.clearAllMocks();
  if (vi.clearAllTimers) {
    vi.clearAllTimers();
  }
});