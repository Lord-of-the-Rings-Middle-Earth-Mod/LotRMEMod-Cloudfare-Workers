# Test Suite for LotRMEMod-Cloudflare-Workers

## Overview

Complete automated test suite for the Cloudflare Workers project, designed to run fully in GitHub Actions without requiring local setup.

## Features

- ✅ **Comprehensive Coverage**: 92.82% statement coverage, exceeding the 80% target
- ✅ **GitHub Actions Integration**: Runs automatically on every commit and PR
- ✅ **Multiple Node.js Versions**: Tests on Node.js 18 & 20
- ✅ **Security Checks**: Automated security auditing and secret scanning
- ✅ **Worker Validation**: Validates Cloudflare Worker syntax
- ✅ **Coverage Reporting**: Detailed coverage metrics and thresholds

## Test Structure

### Unit Tests

| File | Purpose | Tests |
|------|---------|-------|
| `tests/config.test.js` | Tests configuration constants and validation | 8 tests |
| `tests/kvutils.test.js` | Tests KV storage utility functions | 13 tests |
| `tests/discord.test.js` | Tests Discord API integration with mocks | 11 tests |
| `tests/github.test.js` | Tests GitHub webhook handling with mocks | 19 tests |
| `tests/rss.test.js` | Tests RSS feed processing with mocks | 13 tests |
| `tests/mails.test.js` | Tests email handling functionality | 16 tests |

### Integration Tests

| File | Purpose | Tests |
|------|---------|-------|
| `tests/index.test.js` | Tests worker endpoints and routing | 19 tests |

## Running Tests

### Locally

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### GitHub Actions

Tests run automatically on:
- Push to `main` branch
- Pull requests to `main` branch

## Test Framework

- **Framework**: Vitest
- **Environment**: Node.js (mocked Cloudflare APIs)
- **Coverage**: V8 coverage provider
- **Mocking**: Built-in Vitest mocking system

## Key Testing Features

### 1. **Mocked External APIs**
- Discord webhooks
- GitHub API responses
- RSS feeds
- Cloudflare KV storage
- Network requests

### 2. **Edge Case Testing**
- Rate limiting scenarios
- Network failures and retries
- Malformed data handling
- Error conditions
- Security validations

### 3. **Integration Testing**
- Worker endpoint routing
- Request/response handling
- Scheduled cron jobs
- Error propagation

## Coverage Thresholds

Current coverage targets (minimum 80%):
- **Statements**: 92.82% ✅
- **Branches**: 84.11% ✅
- **Functions**: 100% ✅
- **Lines**: 92.82% ✅

## GitHub Actions Workflow

The workflow includes:

1. **Test Matrix**: Node.js 18 & 20
2. **Unit & Integration Tests**
3. **Coverage Reporting**
4. **Worker Validation**: Syntax and startup testing
5. **Security Audit**: NPM audit and secret scanning
6. **Coverage Threshold Enforcement**

## Test Organization

Tests are organized by module with comprehensive coverage:

- **Configuration validation**
- **Utility function testing**
- **API integration testing**
- **Error handling**
- **Data processing and transformation**
- **Webhook handling**
- **Scheduled task execution**

## Development

To add new tests:

1. Create test files following the naming pattern: `{module}.test.js`
2. Use Vitest testing framework
3. Mock external dependencies
4. Ensure coverage thresholds are maintained
5. Update this documentation

## Dependencies

- `vitest`: Test framework
- `@vitest/coverage-v8`: Coverage reporting
- Built-in Node.js mocking for Cloudflare APIs

## Notes

- Tests do not require Cloudflare account or secrets
- All external APIs are mocked
- Tests can run completely offline
- GitHub Actions provides the primary testing environment
- Local testing is supported but not required for CI/CD