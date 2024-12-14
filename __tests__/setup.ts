/* eslint-disable no-console */
import { beforeAll, afterAll, afterEach } from 'vitest';
import { clearPerformanceData } from '../src/performance';

const testPerformance = new Map<string, number>();
const testStartTimes = new Map<string, number>();

beforeAll(() => {
  // Setup global test environment
  global.window = global.window || {} as any;
  let timeCounter = 0;
  const mockPerformance = {
    now: () => timeCounter++,
    mark: () => { /* mock */ },
    measure: () => { /* mock */ },
    clearMarks: () => { /* mock */ },
    clearMeasures: () => { /* mock */ },
    timeOrigin: 0,
    timing: {} as any,
    navigation: {} as any,
    eventCounts: {} as any,
    onresourcetimingbufferfull: null,
    clearResourceTimings: () => { /* mock */ },
    getEntries: () => [],
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    setResourceTimingBufferSize: () => { /* mock */ },
    toJSON: () => ({}),
    addEventListener: () => { /* mock */ },
    removeEventListener: () => { /* mock */ },
    dispatchEvent: () => true,
  };

  global.performance = mockPerformance as unknown as Performance;
});

beforeEach((context) => {
  testStartTimes.set(context.task.name, performance.now());
});

afterEach((context) => {
  const start = testStartTimes.get(context.task.name) ?? performance.now();
  const end = performance.now();
  const duration = end - start;
  testPerformance.set(context.task.name, duration);

  // Log performance data
  console.log(`\nTest: ${context.task.name}`);
  console.log(`Duration: ${duration.toFixed(2)}ms`);
  console.log(`Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);

  clearPerformanceData();
  testStartTimes.delete(context.task.name);
});

afterAll(() => {
  // Print overall performance summary
  console.log('\n=== Performance Summary ===');
  let totalTime = 0;
  testPerformance.forEach((duration, testName) => {
    console.log(`${testName}: ${duration}ms`);
    totalTime += duration;
  });
  console.log(`Total Time: ${totalTime}ms`);
  console.log('========================\n');
});
