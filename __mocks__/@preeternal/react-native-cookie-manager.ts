// __mocks__/@preeternal/react-native-cookie-manager.ts

const mockCookieStore: Record<string, any> = {};

export default {
  // Get cookies for a domain
  get: jest.fn().mockImplementation((domain: string, useWebKit?: boolean) => {
    return Promise.resolve(mockCookieStore[domain] || {});
  }),

  // Set a cookie
  set: jest.fn().mockImplementation((domain: string, cookie: any, useWebKit?: boolean) => {
    if (!mockCookieStore[domain]) {
      mockCookieStore[domain] = {};
    }
    mockCookieStore[domain][cookie.name] = cookie;
    return Promise.resolve(true);
  }),

  // Set cookies from response header
  setFromResponse: jest.fn().mockImplementation((domain: string, cookieString: string) => {
    // Parse simple cookie string (for tests)
    const [name, value] = cookieString.split(';')[0].split('=');
    if (!mockCookieStore[domain]) {
      mockCookieStore[domain] = {};
    }
    mockCookieStore[domain][name] = { name, value };
    return Promise.resolve(true);
  }),

  // Clear all cookies
  clearAll: jest.fn().mockImplementation((useWebKit?: boolean) => {
    Object.keys(mockCookieStore).forEach(key => delete mockCookieStore[key]);
    return Promise.resolve(true);
  }),

  // Clear cookies by name
  clearByName: jest.fn().mockImplementation((domain: string, name: string, useWebKit?: boolean) => {
    if (mockCookieStore[domain] && mockCookieStore[domain][name]) {
      delete mockCookieStore[domain][name];
    }
    return Promise.resolve(true);
  }),

  // Get cookie value (utility for tests)
  getCookieValue: (domain: string, name: string) => {
    return mockCookieStore[domain]?.[name]?.value;
  },

  // Get all cookies (utility for tests)
  getAllCookies: () => mockCookieStore,
};