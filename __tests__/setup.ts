// Add custom matchers if needed
import '@testing-library/jest-dom';

// Mock performance.now() for consistent testing
const originalPerformanceNow = performance.now.bind(performance);
beforeAll(() => {
  let time = 0;
  performance.now = jest.fn(() => time++);
});

afterAll(() => {
  performance.now = originalPerformanceNow;
});
