import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFromKV, saveToKV } from '../src/kvutils.js';

describe('KV Utils Module', () => {
  let mockEnv;
  let mockKVNamespace;

  beforeEach(() => {
    mockKVNamespace = {
      get: vi.fn(),
      put: vi.fn()
    };

    mockEnv = {
      TEST_NAMESPACE: mockKVNamespace
    };
  });

  describe('readFromKV', () => {
    it('should read and parse JSON data from KV store', async () => {
      const testData = { key: 'value', number: 42 };
      mockKVNamespace.get.mockResolvedValue(JSON.stringify(testData));

      const result = await readFromKV(mockEnv, 'TEST_NAMESPACE', 'test-key');

      expect(mockKVNamespace.get).toHaveBeenCalledWith('test-key');
      expect(result).toEqual(testData);
    });

    it('should return null when key does not exist', async () => {
      mockKVNamespace.get.mockResolvedValue(null);

      const result = await readFromKV(mockEnv, 'TEST_NAMESPACE', 'nonexistent-key');

      expect(mockKVNamespace.get).toHaveBeenCalledWith('nonexistent-key');
      expect(result).toBeNull();
    });

    it('should return null when value is empty string', async () => {
      mockKVNamespace.get.mockResolvedValue('');

      const result = await readFromKV(mockEnv, 'TEST_NAMESPACE', 'empty-key');

      expect(mockKVNamespace.get).toHaveBeenCalledWith('empty-key');
      expect(result).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockKVNamespace.get.mockResolvedValue('invalid json');

      await expect(readFromKV(mockEnv, 'TEST_NAMESPACE', 'bad-json-key')).rejects.toThrow();
    });

    it('should handle arrays and complex data structures', async () => {
      const complexData = {
        users: ['user1', 'user2'],
        metadata: {
          created: '2023-01-01',
          version: 1
        }
      };
      mockKVNamespace.get.mockResolvedValue(JSON.stringify(complexData));

      const result = await readFromKV(mockEnv, 'TEST_NAMESPACE', 'complex-key');

      expect(result).toEqual(complexData);
    });
  });

  describe('saveToKV', () => {
    it('should stringify and save data to KV store', async () => {
      const testData = { key: 'value', number: 42 };

      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'test-key', testData);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('test-key', JSON.stringify(testData));
    });

    it('should handle string values', async () => {
      const testValue = 'simple string';

      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'string-key', testValue);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('string-key', JSON.stringify(testValue));
    });

    it('should handle number values', async () => {
      const testValue = 123;

      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'number-key', testValue);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('number-key', JSON.stringify(testValue));
    });

    it('should handle array values', async () => {
      const testValue = ['item1', 'item2', 'item3'];

      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'array-key', testValue);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('array-key', JSON.stringify(testValue));
    });

    it('should handle null values', async () => {
      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'null-key', null);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('null-key', 'null');
    });

    it('should handle boolean values', async () => {
      await saveToKV(mockEnv, 'TEST_NAMESPACE', 'bool-key', true);

      expect(mockKVNamespace.put).toHaveBeenCalledWith('bool-key', 'true');
    });
  });

  describe('error handling', () => {
    it('should handle KV get errors', async () => {
      mockKVNamespace.get.mockRejectedValue(new Error('KV read error'));

      await expect(readFromKV(mockEnv, 'TEST_NAMESPACE', 'error-key')).rejects.toThrow('KV read error');
    });

    it('should handle KV put errors', async () => {
      mockKVNamespace.put.mockRejectedValue(new Error('KV write error'));

      await expect(saveToKV(mockEnv, 'TEST_NAMESPACE', 'error-key', 'value')).rejects.toThrow('KV write error');
    });
  });
});