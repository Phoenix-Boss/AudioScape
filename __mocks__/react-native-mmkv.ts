// __mocks__/react-native-mmkv.ts

const mockStorage = new Map<string, string>();

export const MMKV = jest.fn().mockImplementation(() => ({
  set: jest.fn((key: string, value: string | number | boolean) => {
    mockStorage.set(key, String(value));
  }),
  
  getString: jest.fn((key: string) => mockStorage.get(key) || null),
  
  getNumber: jest.fn((key: string) => {
    const val = mockStorage.get(key);
    return val ? parseFloat(val) : null;
  }),
  
  getBoolean: jest.fn((key: string) => {
    const val = mockStorage.get(key);
    return val === 'true' ? true : val === 'false' ? false : null;
  }),
  
  delete: jest.fn((key: string) => {
    mockStorage.delete(key);
  }),
  
  getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
  
  contains: jest.fn((key: string) => mockStorage.has(key)),
  
  clearAll: jest.fn(() => {
    mockStorage.clear();
  }),
}));

// Utility to clear storage between tests
export const __clearMockStorage = () => {
  mockStorage.clear();
};