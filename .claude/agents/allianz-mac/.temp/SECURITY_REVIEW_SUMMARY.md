# Security Specialist Review Summary

**Task**: Create comprehensive unit tests for `src/lib/concerts.ts` with 80% code coverage  
**Date**: 2026-03-31  
**Confidence**: 88%  
**Status**: APPROVED_FOR_MERGE (with mandatory requirements)

## Quick Verdict

**GO**: Approved for implementation pending mandatory security requirements below.

**Risk Assessment**: 
- **With recommendations**: LOW RISK
- **Without recommendations**: CRITICAL RISK (GDPR violation + auth bypass)

## Critical Security Findings

### 1. Authorization Testing Gap (API1 - Broken Object Level Auth)
**Severity**: CRITICAL

Tests MUST include explicit negative cases proving non-owners cannot modify/delete:
```typescript
test('test_updateConcert_non_owner_returns_null', async () => {
  // User A tries to update User B's concert → should return null
});

test('test_deleteConcert_non_owner_returns_false', async () => {
  // User A tries to delete User B's concert → should return false
});
```

**Why**: Tests must FAIL if the userId check is accidentally removed from updateConcert/deleteConcert.

### 2. Test Data PII Leakage (GDPR + Information Disclosure)
**Severity**: CRITICAL

Test fixtures MUST use ONLY anonymized data:
- ✅ test-user-1@test.example.com
- ✅ test-user-2@test.example.com
- ✅ Berlin: 52.52, 13.405 (well-known city)
- ❌ real@gmail.com
- ❌ john.smith@company.com
- ❌ 42.3601, -71.0589 (actual home coordinates)

**Verification Command**:
```bash
grep -r 'gmail.com\|@company\|@hotmail\|@yahoo\|\.com\.' __tests__/
# Should return ONLY test@example.com matches
```

### 3. Public Profile Filtering (API3 - Broken Object Property Level Auth)
**Severity**: CRITICAL

Filtering responsibility documented in JSDoc:
```typescript
/**
 * Fetch paginated concerts. Caller MUST apply hideLocationPublic/hideCostPublic filtering
 * at API route level before returning to user. This function returns unfiltered data.
 */
export async function getConcertsPaginated(...) { ... }
```

Filtering tests belong at API route level (`app/api/concerts/route.ts`), NOT in concerts.ts tests.

## Mandatory Requirements for Merge

### 1. Authorization Tests (CRITICAL)
- [ ] test_updateConcert_non_owner_returns_null
- [ ] test_deleteConcert_non_owner_returns_false
- [ ] test_getUserConcerts_only_returns_user_data
- [ ] Tests must FAIL if userId checks removed

### 2. Test Data Anonymization (CRITICAL)
- [ ] NO production emails in fixtures
- [ ] NO real UUIDs in fixtures
- [ ] NO real concert locations
- [ ] Use test@example.com pattern exclusively
- [ ] Code review verification: grep for non-test domains

### 3. Prisma Mock Configuration (CRITICAL)
- [ ] Mock configured globally in vitest.setup.ts
- [ ] No real database queries during tests
- [ ] Mocks reset between tests (vi.clearAllMocks())

### 4. TESTING.md Documentation (CRITICAL)
- [ ] Add "GDPR Compliance in Test Data" section
- [ ] Document anonymization rules
- [ ] Add examples of privacy flag tests
- [ ] Add pre-commit hook guidance

### 5. Function Coverage (HIGH)
- [ ] All 25+ major functions have at least one test
- [ ] Target 80% overall line coverage
- [ ] Prioritize authorization and filtering logic

## Top 7 Security Tests Required

| Test | Scenario | Expected | Maps to |
|------|----------|----------|---------|
| test_updateConcert_non_owner_returns_null | User A updates User B's concert | null | API1 |
| test_deleteConcert_non_owner_returns_false | User A deletes User B's concert | false | API1 |
| test_getUserConcerts_only_returns_user_data | Prisma returns multi-user data | Only user's concerts | API1 |
| test_getConcertsPaginated_cursor_validation | Cursor with SQL injection | Empty result | A03 |
| test_parseSupportingActIds_malformed_data | Array with missing bandId | [] or null | A08 |
| test_getConcertsPaginated_limit_boundary | Limit = 101, -1, 1000 | Clamped correctly | API4 |
| test_createConcert_duplicate_detection | Duplicate concert creation | ConcertAlreadyExistsError | Data Integrity |

## OWASP API Security Coverage

| Category | Finding | Priority | Status |
|----------|---------|----------|--------|
| API1 | Broken Object Level Auth | CRITICAL | ❌ Needs tests |
| API3 | Broken Object Property Auth | CRITICAL | ⚠️ Needs docs |
| API4 | Unrestricted Resource Consumption | MEDIUM | ⚠️ Needs tests |
| A03 | Injection | MEDIUM | ⚠️ Needs tests |
| A08 | Data Integrity Failures | HIGH | ⚠️ Needs tests |

## Dependency Audit

| Package | Version | License | CVEs | Verdict |
|---------|---------|---------|------|---------|
| vitest | installed | MIT | None | ✅ APPROVED |
| @vitest/ui | installed | MIT | None | ✅ APPROVED |
| @testing-library/react | check v14+ | MIT | None | ✅ APPROVED |

## Key Recommendations (Priority Order)

### CRITICAL
1. **Write negative auth tests** that FAIL if authorization is removed
2. **Enforce test data anonymization** via pre-commit hook (grep for @gmail.com, production UUIDs)
3. **Document filtering responsibility** in JSDoc (stays at API route level)

### HIGH
4. **Test cursor validation** (empty, null, SQL injection)
5. **Test fork/merge logic** (multi-attendee concert updates)

### MEDIUM
6. **Test edge cases** (date boundaries, coordinate tolerance, array limits)

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `__tests__/lib/concerts.test.ts` | CREATE | Comprehensive test suite (25+ functions, 80% coverage) |
| `TESTING.md` | MODIFY | Add GDPR Compliance section + anonymization rules |
| `vitest.setup.ts` | VERIFY | Prisma mock configuration, no real DB queries |
| `package.json` | VERIFY | Test scripts (test, test:watch, test:coverage) |

## Code Review Checklist

```
[ ] Authorization tests present and correctly structured
[ ] test_updateConcert_non_owner_returns_null exists and fails if check removed
[ ] test_deleteConcert_non_owner_returns_false exists and fails if check removed
[ ] grep -r 'gmail.com' __tests__/ returns empty
[ ] grep -r '@company.com' __tests__/ returns empty
[ ] All test emails use @test.example.com or .test.example.com
[ ] Concert fixtures use well-known coords (Berlin: 52.52, 13.405)
[ ] Band fixtures use generic names (Test Artist One, Test Artist Two)
[ ] Prisma mocked globally in vitest.setup.ts
[ ] No real database queries during test runs
[ ] TESTING.md has GDPR Compliance section
[ ] 25+ major functions tested
[ ] 80%+ overall line coverage achieved
```

## Risk Summary

| Risk | Mitigation | If Skipped |
|------|-----------|-----------|
| Auth bypass (updateConcert/deleteConcert) | Explicit negative tests | CRITICAL |
| PII leakage in test data | Anonymization + pre-commit hook | CRITICAL + GDPR |
| Data filtering bypass | JSDoc clarification + API tests | CRITICAL |
| SQL injection in cursor | Cursor validation tests | HIGH |
| DoS via large arrays | Bounds checking tests | MEDIUM |

## Questions for Tech Lead

1. Should we add a pre-commit hook to prevent production data in tests?
2. Should filtering tests live at API route level (app/api/concerts/route.ts) or concerts.ts level?
3. Should we add a MAX_SUPPORTING_ACTS constant (e.g., 50) to prevent unbounded deserialization?

## Next Steps

1. **Developer**: Implement test suite following mandatory requirements
2. **Code Reviewer**: Verify auth tests, anonymization, Prisma mocks using checklist above
3. **Tech Lead**: Approve TESTING.md GDPR section and authorization test structure
4. **QA**: Run yarn test:coverage and verify 80%+ coverage on concerts.ts

---

For detailed findings, see: `.claude/agents/allianz-mac/.temp/proposal-security-specialist.json`
