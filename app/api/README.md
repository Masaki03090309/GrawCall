# API Testing Guide

## Current Status

API Route testing in Next.js 14 App Router requires special setup. We are currently focusing on:

1. Unit tests for utility functions (✓ Working)
2. Component tests (TODO)
3. E2E tests with Playwright (TODO)

## Testing Strategy

### Phase 1: Basic Tests (Current)

- ✓ Utility functions (`lib/utils.test.ts`)
- Helper functions
- Data transformations

### Phase 2: Component Tests (P2 Priority)

- React component rendering
- User interactions
- State management

### Phase 3: E2E Tests (Phase 7)

- Full API integration tests
- Database operations
- Authentication flows

## Why Not Unit Test API Routes Now?

Next.js 14 App Router API routes use Web APIs (Request, Response) that require complex mocking in Jest. Instead, we will:

1. Use Playwright for E2E testing (Phase 7)
2. Manual testing during development
3. CI/CD integration tests in Cloud Run environment

## Future Work

- [ ] Set up Playwright for API integration tests
- [ ] Add database integration tests with test database
- [ ] Add authentication flow tests

---

For now, focus on utility functions and component tests. Full API testing will be implemented in Phase 7 (Testing & Improvements).
