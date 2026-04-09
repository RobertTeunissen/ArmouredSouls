---
inclusion: manual
---

# Common Tasks and Workflows

## Development Workflow

### Starting Development
1. Review `docs/guides/SETUP.md` for environment setup
2. Read relevant PRD documents (docs/prd_core/ or docs/prd_pages/)
3. Check `docs/guides/MODULE_STRUCTURE.md` for code organization
4. Review `docs/guides/TESTING_STATE.md` for current test status

### Adding New Features
1. **Research**: Read related PRD documents in docs/prd_core/ and docs/prd_pages/
2. **Plan**: Identify affected files and systems
3. **Implement**: Follow coding standards
4. **Write Tests**: Create comprehensive tests (minimum 80% coverage, 90% for critical functionality)
5. **Run Tests**: Execute full test suite and verify all tests pass
6. **Document**: Update or create documentation
7. **Verify Coverage**: Check coverage report meets minimum thresholds

### Modifying Existing Features
1. **Understand**: Read code and documentation for current behavior
2. **Dependencies**: Review related systems and dependencies
3. **Implement**: Make code changes
4. **Update Tests**: Modify existing tests and add new tests as needed
5. **Run Tests**: Execute full test suite and verify all tests pass
6. **Document**: Update PRD documents to reflect changes
7. **Verify Coverage**: Ensure coverage still meets minimum thresholds

### Debugging Issues
1. Check `docs/guides/TROUBLESHOOTING.md`
2. Review `docs/troubleshooting/` for known issues
3. Check logs in `app/backend/cycle_logs/`
4. Use `diagnostic.sh` if available
5. Document solution in troubleshooting docs if novel

## Common File Locations

### Backend
- **Services**: `app/backend/src/services/`
- **Routes**: `app/backend/src/routes/`
- **Database**: `app/backend/src/db/`
- **Types**: `app/backend/src/types/`
- **Config**: `app/backend/.env` (never commit!)

### Frontend
- **Components**: `app/frontend/src/components/`
- **Pages**: `app/frontend/src/pages/`
- **Services**: `app/frontend/src/services/`
- **Types**: `app/frontend/src/types/`
- **Styles**: `app/frontend/src/styles/`

### Documentation
- **Core specs**: `docs/prd_core/`
- **Page specs**: `docs/prd_pages/`
- **Guides**: `docs/guides/`
- **Design**: `docs/design_ux/`

## Database Operations

### Schema Changes
1. Review `docs/prd_core/DATABASE_SCHEMA.md`
2. Create migration script
3. Test migration on development database
4. Update DATABASE_SCHEMA.md
5. Document in `docs/migrations/`

### Querying Best Practices
- Use parameterized queries
- Add indexes for frequently queried columns
- Use transactions for multi-step operations
- Handle errors gracefully
- Log slow queries for optimization

## API Development

### Adding New Endpoints
1. Define route in appropriate router file
2. Implement handler function
3. Add input validation
4. Handle errors appropriately
5. Document in API documentation
6. Test with various inputs

### API Response Format
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "Error message" }
```

## Game Balance Changes

When modifying game balance:
1. Document rationale in `docs/balance_changes/`
2. Update relevant PRD documents
3. Consider impact on existing players
4. Test with various scenarios
5. Monitor after deployment

## Security Considerations

Always review `docs/guides/SECURITY.md` when:
- Adding authentication/authorization
- Handling user input
- Accessing database
- Implementing API endpoints
- Storing sensitive data

## Deployment

See `docs/guides/DEPLOYMENT.md` for:
- Production deployment process
- Environment configuration
- Database migrations
- Rollback procedures

## Maintenance

See `docs/guides/MAINTENANCE.md` for:
- Regular maintenance tasks
- Monitoring procedures
- Backup strategies
- Performance optimization

## Quick Reference Commands

### Backend
```bash
# Development
cd app/backend
npm install
npm run dev

# Build
npm run build

# Database
# See .env for connection details
```

### Frontend
```bash
# Development
cd app/frontend
npm install
npm run dev

# Build
npm run build
```

## Getting Help

1. **Documentation** - Check docs/ directory first
2. **Code comments** - Review inline documentation
3. **README files** - Check module-specific READMEs
4. **Troubleshooting** - See docs/troubleshooting/
5. **Security** - See docs/guides/SECURITY_ADVISORY.md
