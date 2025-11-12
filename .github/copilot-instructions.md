# GitHub Copilot Instructions for LotRMEMod-Cloudflare-Workers

## Test Maintenance Guidelines

This repository maintains a comprehensive test suite with **112 tests** and **93.4% coverage**. All code changes must maintain or improve test coverage to keep the codebase reliable and maintainable.

### 🚨 CRITICAL: Test Requirements for All Changes

**ALWAYS follow these test requirements when making code changes:**

#### 1. When Modifying Existing Functionality
- **Update existing tests** that cover the modified functionality
- **Verify test assertions** still match the expected behavior after changes
- **Run the affected test files** to ensure they pass: `npm test`
- **Check coverage impact** with: `npm run test:coverage`

#### 2. When Adding New Functionality
- **Create new test cases** for all new functions, endpoints, or features
- **Follow existing test patterns** found in the `/tests` directory
- **Mock external APIs** (Discord, GitHub, RSS) consistently with existing mocks
- **Test both success and error scenarios** including edge cases

#### 3. Test Coverage Requirements
- **Maintain minimum 80% coverage** across all metrics (statements, branches, functions, lines)
- **Current coverage is 93.4%** - do not let it drop below this level
- **Coverage is enforced in CI/CD** and will fail builds if thresholds aren't met

## Test File Organization

### Current Test Structure
```
tests/
├── config.test.js      # Configuration constants and validation (8 tests)
├── kvutils.test.js     # KV storage utility functions (13 tests)  
├── discord.test.js     # Discord API integration with mocks (11 tests)
├── github.test.js      # GitHub webhook handling with mocks (36 tests)
├── rss.test.js         # RSS feed processing with mocks (13 tests)
├── mails.test.js       # Email handling functionality (12 tests)
├── index.test.js       # Worker endpoints and routing (19 tests)
└── setup.js           # Test setup and configuration
```

### Test Naming Convention
- **File naming**: `{module}.test.js` (matches the source file name)
- **Test descriptions**: Use clear, descriptive names that explain what is being tested
- **Test grouping**: Use `describe()` blocks to organize related tests

## Testing Framework Guidelines

### Vitest Configuration
- **Framework**: Vitest with built-in mocking capabilities
- **Environment**: Node.js with mocked Cloudflare APIs
- **Coverage**: V8 coverage provider with detailed reporting

### Mocking External Dependencies
**Always mock external APIs** to ensure tests run reliably:
- **Discord webhooks**: Mock HTTP requests to Discord API endpoints
- **GitHub API**: Mock responses for webhook handling and API calls  
- **RSS feeds**: Mock fetch responses for feed processing
- **Cloudflare KV**: Mock storage operations for key-value operations
- **Network requests**: Use Vitest's built-in mocking system

### Example Test Patterns

#### Testing a New Function
```javascript
describe('New Module', () => {
  describe('newFunction', () => {
    it('should handle valid input correctly', () => {
      // Test success case
    });
    
    it('should throw error for invalid input', () => {
      // Test error case
    });
    
    it('should handle edge cases', () => {
      // Test edge cases
    });
  });
});
```

#### Mocking External APIs
```javascript
// Mock Discord API
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 204,
    json: () => Promise.resolve({}),
  })
);
```

## Running Tests

### Local Development
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage  

# Run tests in watch mode during development
npm run test:watch
```

### GitHub Actions Integration
Tests run automatically on:
- **Push to main branch**
- **Pull requests to main** (non-draft PRs)
- **Nightly schedule** at 2:00 AM European Time

## Test Quality Checklist

Before submitting any code changes, ensure:

- [ ] **All existing tests pass**: `npm test`
- [ ] **New functionality has tests**: Every new function/endpoint covered
- [ ] **Modified functionality tests updated**: Tests reflect behavior changes  
- [ ] **Coverage maintained/improved**: Check `npm run test:coverage`
- [ ] **Mocks are properly implemented**: No real external API calls in tests
- [ ] **Error scenarios tested**: Both success and failure cases covered
- [ ] **Edge cases considered**: Boundary conditions and unusual inputs tested

## Common Test Scenarios to Cover

### For API Endpoints (index.js)
- Request routing and method validation
- Response status codes and content
- Error handling and status responses
- CORS headers and security

### For External Integrations (discord.js, github.js, etc.)
- Successful API interactions
- Network failures and retry logic
- Rate limiting scenarios  
- Malformed response handling
- Authentication/authorization

### For Utility Functions (kvutils.js, config.js)
- Input validation and sanitization
- Data transformation correctness
- Error conditions and exception handling
- Boundary value testing

## Debugging Test Failures

### Coverage Issues
If coverage drops below thresholds:
1. **Identify uncovered lines**: Check coverage report details
2. **Add targeted tests**: Focus on uncovered code paths
3. **Review existing tests**: Ensure they're actually testing the intended code

### Test Failures
1. **Run individual test files**: `npx vitest tests/{filename}.test.js`
2. **Check mock configurations**: Ensure mocks match expected API behavior
3. **Verify test isolation**: Tests should not depend on each other
4. **Review recent code changes**: Check if functionality changes broke tests

## Additional Guidelines

- **Keep tests focused**: One test should verify one specific behavior
- **Use descriptive assertions**: Make it clear what is expected vs actual
- **Maintain test performance**: Tests should run quickly (current suite runs in ~1.14s)
- **Document complex test setups**: Add comments for intricate mocking or setup logic
- **Follow existing patterns**: Consistency with current test style is important

---

**Remember**: This repository has achieved excellent test coverage (92.82%). Help maintain this high standard by always considering tests as a core part of any code change, not an afterthought.