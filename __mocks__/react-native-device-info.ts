// __mocks__/react-native-device-info.ts

const mockDeviceInfo = {
  deviceId: 'test-device-id-12345',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  systemName: 'iOS',
  systemVersion: '17.2.1',
  model: 'iPhone 15 Pro',
  brand: 'Apple',
  isTablet: false,
  hasNotch: true,
  screenWidth: 1179,
  screenHeight: 2556,
};

export default {
  getUniqueId: jest.fn().mockResolvedValue(mockDeviceInfo.deviceId),
  getUserAgent: jest.fn().mockResolvedValue(mockDeviceInfo.userAgent),
  getSystemName: jest.fn().mockResolvedValue(mockDeviceInfo.systemName),
  getSystemVersion: jest.fn().mockResolvedValue(mockDeviceInfo.systemVersion),
  getModel: jest.fn().mockResolvedValue(mockDeviceInfo.model),
  getBrand: jest.fn().mockResolvedValue(mockDeviceInfo.brand),
  isTablet: jest.fn().mockResolvedValue(mockDeviceInfo.isTablet),
  hasNotch: jest.fn().mockResolvedValue(mockDeviceInfo.hasNotch),
  getScreenWidth: jest.fn().mockResolvedValue(mockDeviceInfo.screenWidth),
  getScreenHeight: jest.fn().mockResolvedValue(mockDeviceInfo.screenHeight),
  getBatteryLevel: jest.fn().mockResolvedValue(0.85),
  isEmulator: jest.fn().mockResolvedValue(false),
  getDeviceType: jest.fn().mockResolvedValue('Handset'),
  getDeviceName: jest.fn().mockResolvedValue('Test iPhone'),
  getManufacturer: jest.fn().mockResolvedValue('Apple'),
  getDeviceLocale: jest.fn().mockResolvedValue('en-US'),
  getDeviceCountry: jest.fn().mockResolvedValue('US'),
  getTimezone: jest.fn().mockResolvedValue('America/New_York'),
  
  // Helper to update mock values in tests
  __setMockValues: (values: Partial<typeof mockDeviceInfo>) => {
    Object.assign(mockDeviceInfo, values);
  },
  
  // Helper to reset to defaults
  __resetMockValues: () => {
    Object.assign(mockDeviceInfo, {
      deviceId: 'test-device-id-12345',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
      systemName: 'iOS',
      systemVersion: '17.2.1',
      model: 'iPhone 15 Pro',
      brand: 'Apple',
    });
  },
};