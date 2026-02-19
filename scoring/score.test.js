const fs = require('fs');
const path = require('path');
const { BishopScorer } = require('./score');

jest.mock('fs');

describe('BishopScorer', () => {
  let scorer;

  beforeEach(() => {
    jest.clearAllMocks();
    scorer = new BishopScorer();
  });

  describe('getLatestResults', () => {
    it('should return the latest evaluation file', () => {
      const mockFiles = [
        'eval-2023-01-01.json',
        'eval-2023-01-02.json',
        'other.txt',
        'random-file.json'
      ];
      fs.readdirSync.mockReturnValue(mockFiles);

      const latest = scorer.getLatestResults();

      // It should pick eval-2023-01-02.json as it is the latest lexicographically
      const expectedPath = path.join(scorer.resultsDir, 'eval-2023-01-02.json');
      expect(latest).toBe(expectedPath);
      expect(fs.readdirSync).toHaveBeenCalledWith(scorer.resultsDir);
    });

    it('should throw an error if no matching files are found', () => {
      const mockFiles = ['other.txt', 'results.json', 'eval-draft.txt'];
      fs.readdirSync.mockReturnValue(mockFiles);

      expect(() => {
        scorer.getLatestResults();
      }).toThrow('No evaluation results found. Run an evaluation first.');
    });

    it('should throw an error if directory is empty', () => {
      fs.readdirSync.mockReturnValue([]);

      expect(() => {
        scorer.getLatestResults();
      }).toThrow('No evaluation results found. Run an evaluation first.');
    });
  });
});
