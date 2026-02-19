const { BishopScorer } = require('./score');

describe('BishopScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new BishopScorer();
  });

  describe('aggregateScores', () => {
    test('should return empty object for empty list', () => {
      expect(scorer.aggregateScores([])).toEqual({});
    });

    test('should aggregate single item correctly', () => {
      const input = [{ score: 10, time: 5 }];
      const result = scorer.aggregateScores(input);

      expect(result).toEqual({
        score_avg: 10,
        score_min: 10,
        score_max: 10,
        time_avg: 5,
        time_min: 5,
        time_max: 5
      });
    });

    test('should aggregate multiple items correctly', () => {
      const input = [
        { score: 10, time: 5 },
        { score: 20, time: 15 },
        { score: 30, time: 10 }
      ];
      const result = scorer.aggregateScores(input);

      expect(result.score_avg).toBe(20);
      expect(result.score_min).toBe(10);
      expect(result.score_max).toBe(30);

      expect(result.time_avg).toBe(10);
      expect(result.time_min).toBe(5);
      expect(result.time_max).toBe(15);
    });

    test('should ignore non-numeric values', () => {
      const input = [
        { score: 10 },
        { score: 'invalid' }, // string
        { score: null },      // null
        { score: undefined }, // undefined
        { score: 20 }
      ];
      const result = scorer.aggregateScores(input);

      expect(result.score_avg).toBe(15); // (10 + 20) / 2
      expect(result.score_min).toBe(10);
      expect(result.score_max).toBe(20);
    });

    test('should handle keys missing in some objects (based on first object keys)', () => {
      // The implementation iterates over keys of the first object.
      // If a key is missing in subsequent objects, it will be undefined, which is not a number, so ignored.
      const input = [
        { a: 10, b: 20 },
        { a: 30 },        // b missing
        { b: 40 }         // a missing
      ];

      // key 'a': from first obj (10). Second obj (30). Third obj (undefined -> ignored).
      // key 'b': from first obj (20). Second obj (undefined -> ignored). Third obj (40).

      const result = scorer.aggregateScores(input);

      expect(result.a_avg).toBe(20); // (10 + 30) / 2
      expect(result.b_avg).toBe(30); // (20 + 40) / 2
    });

    test('should ignore keys present in subsequent objects but not first', () => {
      const input = [
        { a: 10 },
        { a: 20, b: 30 }
      ];
      const result = scorer.aggregateScores(input);

      expect(result.a_avg).toBe(15);
      expect(result.b_avg).toBeUndefined(); // b is not in first object, so ignored
    });

    test('should omit key if all values are non-numeric', () => {
      const input = [
        { a: 'string' },
        { a: null }
      ];
      const result = scorer.aggregateScores(input);
      expect(result).toEqual({});
    });
  });
});
