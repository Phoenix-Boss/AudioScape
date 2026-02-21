// __mocks__/@react-native-community/netinfo.ts

const mockNetInfo = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  isConnectionExpensive: false,
  carrier: 'Test Carrier',
  details: {
    ipAddress: '192.168.1.100',
    subnet: '255.255.255.0',
  },
};

export default {
  fetch: jest.fn().mockResolvedValue(mockNetInfo),
  
  addEventListener: jest.fn().mockImplementation((callback) => {
    // Return a subscription object
    return {
      remove: jest.fn(),
    };
  }),
  
  useNetInfo: jest.fn().mockReturnValue(mockNetInfo),
  
  configure: jest.fn(),
  
  // Helper to update mock values in tests
  __setMockValues: (values: Partial<typeof mockNetInfo>) => {
    Object.assign(mockNetInfo, values);
    // Also update the fetch mock
    jest.spyOn(exports.default, 'fetch').mockResolvedValue(mockNetInfo);
  },
  
  // Helper to reset to defaults
  __resetMockValues: () => {
    Object.assign(mockNetInfo, {
      type: 'wifi',
      isConnected: true,
      isInternetReachable: true,
      isConnectionExpensive: false,
      carrier: 'Test Carrier',
      details: { ipAddress: '192.168.1.100' },
    });
  },
};