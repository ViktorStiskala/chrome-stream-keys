/**
 * Vitest setup file
 * Mocks Chrome extension APIs and provides global test helpers
 */

import { vi, beforeEach, afterEach } from 'vitest';

// Mock Chrome extension APIs
const mockStorage = {
  data: {},
  sync: {
    get: vi.fn((key) => {
      return Promise.resolve({ [key]: mockStorage.data[key] });
    }),
    set: vi.fn((data) => {
      Object.assign(mockStorage.data, data);
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      mockStorage.data = {};
      return Promise.resolve();
    })
  }
};

const mockScripting = {
  executeScript: vi.fn(() => Promise.resolve([{ result: undefined }]))
};

const mockWebNavigation = {
  onCompleted: {
    addListener: vi.fn()
  }
};

// Create the chrome global mock
global.chrome = {
  storage: mockStorage,
  scripting: mockScripting,
  webNavigation: mockWebNavigation,
  runtime: {
    lastError: null,
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`)
  }
};

// Mock window.__streamKeysSettings for handler tests
global.setupStreamKeysSettings = (settings = {}) => {
  window.__streamKeysSettings = {
    subtitleLanguages: ['English', 'English [CC]', 'English CC'],
    ...settings
  };
};

// Reset settings before each test
beforeEach(() => {
  window.__streamKeysSettings = {
    subtitleLanguages: ['English', 'English [CC]', 'English CC']
  };
});

// Clean up after each test
afterEach(() => {
  // Reset storage mock
  mockStorage.data = {};
  
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clean up DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Remove any event listeners that might have been added
  // (this is a best-effort cleanup)
});

// Helper to create keyboard events
global.createKeyboardEvent = (code, options = {}) => {
  return new KeyboardEvent('keydown', {
    code,
    key: code.replace('Key', ''),
    bubbles: true,
    cancelable: true,
    ...options
  });
};

// Helper to simulate keyboard press with capture phase
global.simulateKeyPress = (element, code, options = {}) => {
  const event = createKeyboardEvent(code, options);
  element.dispatchEvent(event);
  return event;
};

// Helper to wait for next tick
global.nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// Helper to wait for multiple ticks (useful for setInterval-based code)
global.waitTicks = (count = 1, delay = 10) => {
  return new Promise(resolve => setTimeout(resolve, delay * count));
};

// Export mocks for direct access in tests
export { mockStorage, mockScripting, mockWebNavigation };

