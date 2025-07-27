# KV Storage Utilities

This module provides utility functions for interacting with Cloudflare Workers KV storage, offering a simple interface for reading and writing data with automatic JSON serialization.

## Features

- **Simple Interface**: Easy-to-use functions for KV operations
- **JSON Handling**: Automatic serialization and deserialization
- **Error Handling**: Graceful handling of missing keys and storage errors
- **German Documentation**: Function comments in German (original implementation language)

## Configuration

KV namespaces are configured in `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FABRIC_KV"
id = "c762173a2f01465faee2d33d4631e9c8"
```

## Core Functions

### `readFromKV(env, namespace, key)`

Reads data from KV storage with automatic JSON parsing.

```javascript
export const readFromKV = async (env, namespace, key) => {
  const data = await env[namespace].get(key);
  return data ? JSON.parse(data) : null;
};
```

**Parameters:**
- `env` (Object): Environment object containing KV namespace bindings
- `namespace` (string): The KV namespace binding name (e.g., "FABRIC_KV")
- `key` (string): The key to read from storage

**Returns:**
- `Promise<any>`: Parsed JSON data or `null` if key doesn't exist

**Example Usage:**
```javascript
// Read processed RSS entries
const processedEntries = await readFromKV(env, 'FABRIC_KV', 'fabric_rss_processed_entries') || [];

// Read configuration data
const settings = await readFromKV(env, 'FABRIC_KV', 'app_settings');
if (settings) {
  console.log('Found settings:', settings);
}
```

### `saveToKV(env, namespace, key, value)`

Saves data to KV storage with automatic JSON serialization.

```javascript
export const saveToKV = async (env, namespace, key, value) => {
  await env[namespace].put(key, JSON.stringify(value));
};
```

**Parameters:**
- `env` (Object): Environment object containing KV namespace bindings
- `namespace` (string): The KV namespace binding name (e.g., "FABRIC_KV")
- `key` (string): The key to store data under
- `value` (any): The value to store (will be JSON serialized)

**Returns:**
- `Promise<void>`: Resolves when data is successfully stored

**Example Usage:**
```javascript
// Save processed RSS entries
const updatedEntries = [...processedEntries, newEntry.id];
await saveToKV(env, 'FABRIC_KV', 'fabric_rss_processed_entries', updatedEntries);

// Save configuration
const newSettings = { lastUpdate: Date.now(), enabled: true };
await saveToKV(env, 'FABRIC_KV', 'app_settings', newSettings);
```

## Usage by Other Modules

### RSS Integration
The RSS module uses KV storage to track processed entries and prevent duplicates:

```javascript
import { readFromKV, saveToKV } from './kvutils.js';

// Read previously processed entries
const processedEntries = await readFromKV(env, 'FABRIC_KV', 'fabric_rss_processed_entries') || [];

// Update with new entries
processedEntries.push(newEntry.id);
await saveToKV(env, 'FABRIC_KV', 'fabric_rss_processed_entries', processedEntries);
```

## Data Types

The utilities support any JSON-serializable data:

- **Primitives**: strings, numbers, booleans, null
- **Arrays**: `['item1', 'item2', 'item3']`
- **Objects**: `{ key: 'value', nested: { data: true } }`
- **Complex Structures**: Nested combinations of the above

## Error Handling

### Read Operations
- **Missing Keys**: Returns `null` instead of throwing errors
- **Invalid JSON**: JSON parsing errors will throw (should be caught by caller)
- **KV Errors**: Network/storage errors propagate to caller

### Write Operations  
- **Serialization Errors**: JSON.stringify errors will throw
- **KV Errors**: Storage errors propagate to caller
- **No Return Validation**: Function assumes success if no error thrown

## Performance Considerations

### KV Storage Characteristics
- **Eventually Consistent**: Changes may take time to propagate globally
- **Read Performance**: Optimized for high-frequency reads
- **Write Performance**: Optimized for infrequent writes
- **Size Limits**: 25 MB per value, 100MB per key

### Best Practices
- **Batch Updates**: Group multiple changes when possible
- **Key Design**: Use descriptive, hierarchical key names
- **Data Structure**: Minimize nesting depth for better performance
- **Cleanup**: Implement data cleanup for growing datasets

## Current Usage

### RSS Feed Tracking
```javascript
// Key: 'fabric_rss_processed_entries'
// Value: Array of processed RSS entry IDs
// Purpose: Prevent duplicate processing of RSS entries
// Cleanup: Limited to last 100 entries to prevent unbounded growth
```

## Testing

To test KV storage utilities:

1. **Read Test**: 
```javascript
const result = await readFromKV(env, 'FABRIC_KV', 'test_key');
console.log('Read result:', result);
```

2. **Write Test**:
```javascript
await saveToKV(env, 'FABRIC_KV', 'test_key', { test: 'data', timestamp: Date.now() });
```

3. **Round Trip Test**:
```javascript
const testData = { array: [1, 2, 3], object: { nested: true } };
await saveToKV(env, 'FABRIC_KV', 'roundtrip_test', testData);
const retrieved = await readFromKV(env, 'FABRIC_KV', 'roundtrip_test');
console.log('Data matches:', JSON.stringify(testData) === JSON.stringify(retrieved));
```

## Security Considerations

- **No Encryption**: Data stored in plain text (JSON)
- **Access Control**: Limited to worker environment permissions
- **Key Exposure**: Key names may be visible in logs/code
- **Data Persistence**: Data persists beyond worker deployments

## Files

- `src/kvutils.js`: Main KV utility implementation
- `wrangler.toml`: KV namespace configuration

## Dependencies

- Cloudflare Workers KV API (via `env` object)
- Native JSON serialization/deserialization
- No external libraries required

## Related Documentation

- [RSS Integration](RSS_INTEGRATION.md) - Primary user of KV storage utilities
- [Configuration](README.md#configuration) - KV namespace setup details