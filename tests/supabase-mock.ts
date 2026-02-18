// tests/mocks/supabase-mock.ts

export const mockSupabaseClient = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  
  // Mock responses
  mockResolve: (data: any) => {
    mockSupabaseClient.select.mockImplementationOnce(() => ({
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data, error: null }),
      single: jest.fn().mockResolvedValue({ data, error: null }),
    }));
  },
  
  mockReject: (error: any) => {
    mockSupabaseClient.select.mockImplementationOnce(() => ({
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error }),
      single: jest.fn().mockResolvedValue({ data: null, error }),
    }));
  }
};