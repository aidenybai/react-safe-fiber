import { describe, it, expect, beforeEach } from 'vitest';
import type { VNode } from 'preact';
import { calculateTreeDuration, clearPerformanceData } from '../src/performance';

describe('Performance Monitoring', () => {
  beforeEach(() => {
    clearPerformanceData();
  });

  describe('calculateTreeDuration', () => {
    it('handles invalid nodes gracefully', () => {
      expect(calculateTreeDuration(null)).toBe(0);
      expect(calculateTreeDuration(undefined)).toBe(0);
      expect(calculateTreeDuration({} as VNode)).toBe(0);
    });

    it('handles circular references', () => {
      const node: any = {
        type: 'div',
        props: {},
        actualDuration: 100
      };
      node.child = {
        type: 'span',
        props: {},
        actualDuration: 50,
        child: node
      };
      expect(calculateTreeDuration(node)).toBe(150);
    });

    it('accumulates nested durations', () => {
      const node = {
        type: 'div',
        props: {},
        actualDuration: 100,
        child: {
          type: 'span',
          props: {},
          actualDuration: 50,
          sibling: {
            type: 'p',
            props: {},
            actualDuration: 25
          }
        }
      };
      expect(calculateTreeDuration(node)).toBe(175);
    });

    it('handles complex component trees', () => {
      const tree = {
        type: 'div',
        key: null,
        props: {
          children: [
            {
              type: 'span',
              key: null,
              props: {},
              actualDuration: 20
            },
            {
              type: 'p',
              key: null,
              props: {},
              actualDuration: 30
            }
          ]
        },
        actualDuration: 50
      } as unknown as VNode;
      expect(calculateTreeDuration(tree)).toBe(100);
    });

    it('returns 0 for nodes without duration', () => {
      const node = {
        type: 'div',
        props: {}
      };
      expect(calculateTreeDuration(node as VNode)).toBe(0);
    });
  });
});
