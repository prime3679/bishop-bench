const fs = require('fs');
const { BishopScorer } = require('../score');

jest.mock('fs');

describe('BishopScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new BishopScorer();
    jest.clearAllMocks();
  });

  describe('loadResults', () => {
    it('should throw an error if the results file does not exist', () => {
      const resultFile = 'non-existent-file.json';
      fs.existsSync.mockReturnValue(false);

      expect(() => {
        scorer.loadResults(resultFile);
      }).toThrow(`Results file not found: ${resultFile}`);

      expect(fs.existsSync).toHaveBeenCalledWith(resultFile);
    });

    it('should load and parse the results file if it exists', () => {
      const resultFile = 'results.json';
      const mockContent = JSON.stringify([{ id: 1, result: 'success' }]);
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockContent);

      const result = scorer.loadResults(resultFile);

      expect(result).toEqual([{ id: 1, result: 'success' }]);
      expect(fs.existsSync).toHaveBeenCalledWith(resultFile);
      expect(fs.readFileSync).toHaveBeenCalledWith(resultFile, 'utf8');
    });
  });
});
