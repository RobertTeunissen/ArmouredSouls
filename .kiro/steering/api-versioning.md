---
inclusion: fileMatch
fileMatchPattern: "**/routes/**,**/api/**,**/*.route.ts,**/*.router.ts"
---

# API Versioning and Breaking Changes

## Versioning Strategy

### Current Approach
- **No versioning yet** - Single API version
- **Future**: URL-based versioning when needed (`/api/v1/`, `/api/v2/`)
- **Backward compatibility**: Maintain for at least 6 months

### When to Version

**Create New Version When**:
- Breaking changes to existing endpoints
- Significant API restructuring
- Major feature overhauls
- Changes that would break existing clients

**Don't Version For**:
- Adding new endpoints
- Adding optional parameters
- Adding new response fields
- Bug fixes
- Performance improvements

## Breaking Changes

### What Constitutes a Breaking Change

**Breaking Changes**:
- Removing endpoints
- Removing request/response fields
- Changing field types
- Changing field names
- Changing HTTP methods
- Changing authentication requirements
- Changing error response format
- Making optional fields required

**Non-Breaking Changes**:
- Adding new endpoints
- Adding optional request parameters
- Adding new response fields
- Deprecating (but not removing) endpoints
- Improving error messages
- Performance optimizations

### Handling Breaking Changes

**Process**:
1. **Plan**: Document breaking changes and migration path
2. **Deprecate**: Mark old version as deprecated
3. **Communicate**: Announce deprecation timeline (minimum 6 months)
4. **Support**: Maintain both versions during transition
5. **Remove**: Remove old version after deprecation period

**Example Deprecation Notice**:
```typescript
// In API response headers
res.setHeader('X-API-Deprecation', 'This endpoint is deprecated. Use /api/v2/robots instead.');
res.setHeader('X-API-Sunset', '2026-09-01'); // Removal date
```

## API Versioning Implementation

### URL-Based Versioning

**Route Structure**:
```typescript
// Version 1
app.use('/api/v1/robots', robotsV1Router);
app.use('/api/v1/battles', battlesV1Router);

// Version 2 (when needed)
app.use('/api/v2/robots', robotsV2Router);
app.use('/api/v2/battles', battlesV2Router);

// Default to latest version
app.use('/api/robots', robotsV2Router);
app.use('/api/battles', battlesV2Router);
```

### Version-Specific Controllers

**Separate Controllers Per Version**:
```
src/
├── routes/
│   ├── v1/
│   │   ├── robots.ts
│   │   └── battles.ts
│   └── v2/
│       ├── robots.ts
│       └── battles.ts
```

### Shared Business Logic

**Reuse Services Across Versions**:
```typescript
// services/robotService.ts (shared)
export const robotService = {
  getAll: () => prisma.robot.findMany(),
  getById: (id: number) => prisma.robot.findUnique({ where: { id } }),
};

// routes/v1/robots.ts
app.get('/api/v1/robots', async (req, res) => {
  const robots = await robotService.getAll();
  res.json({ success: true, data: robots }); // v1 format
});

// routes/v2/robots.ts
app.get('/api/v2/robots', async (req, res) => {
  const robots = await robotService.getAll();
  res.json({ robots, meta: { version: 2 } }); // v2 format
});
```

## Deprecation Strategy

### Deprecation Process

**Step 1: Mark as Deprecated**:
```typescript
/**
 * @deprecated Use /api/v2/robots instead. Will be removed on 2026-09-01.
 */
app.get('/api/v1/robots/:id', async (req, res) => {
  res.setHeader('X-API-Deprecation', 'true');
  res.setHeader('X-API-Sunset', '2026-09-01');
  
  // Existing implementation
});
```

**Step 2: Log Deprecated Usage**:
```typescript
function deprecationMiddleware(req, res, next) {
  logger.warn('Deprecated API endpoint used', {
    endpoint: req.path,
    method: req.method,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  next();
}

app.use('/api/v1/*', deprecationMiddleware);
```

**Step 3: Communicate to Users**:
- Update API documentation
- Send email notifications
- Display warnings in developer console
- Add banner to API documentation site

**Step 4: Monitor Usage**:
- Track deprecated endpoint usage
- Identify clients still using old version
- Contact heavy users directly

**Step 5: Remove After Sunset**:
- Remove deprecated endpoints
- Update documentation
- Return 410 Gone for removed endpoints

### Sunset Response

**After Removal**:
```typescript
app.all('/api/v1/*', (req, res) => {
  res.status(410).json({
    success: false,
    error: {
      code: 'API_VERSION_REMOVED',
      message: 'API v1 has been removed. Please use /api/v2/ instead.',
      sunset: '2026-09-01',
      documentation: 'https://docs.armouredsouls.com/api/v2'
    }
  });
});
```

## Backward Compatibility

### Maintaining Compatibility

**Add, Don't Remove**:
```typescript
// Good - Adding optional field
interface RobotResponse {
  id: number;
  name: string;
  elo: number;
  imageUrl?: string; // New optional field
}

// Bad - Removing field (breaking change)
interface RobotResponse {
  id: number;
  name: string;
  // elo removed - BREAKING!
}
```

**Expand, Don't Contract**:
```typescript
// Good - Accept more input formats
function parseDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}

// Bad - Restrict input formats (breaking change)
function parseDate(input: Date): Date {
  return input; // No longer accepts strings
}
```

### Response Format Evolution

**Maintain Old Format While Adding New**:
```typescript
// v1 response
{
  "success": true,
  "data": { "id": 1, "name": "Robot" }
}

// v2 response (adds meta, keeps data)
{
  "success": true,
  "data": { "id": 1, "name": "Robot" },
  "meta": { "version": 2, "timestamp": "2026-03-02T10:00:00Z" }
}
```

## Migration Guides

### Provide Clear Migration Paths

**Example Migration Guide**:
```markdown
# Migrating from API v1 to v2

## Breaking Changes

### 1. Robot Response Format
**v1**:
```json
{
  "success": true,
  "data": { "id": 1, "name": "Robot", "armor": 100 }
}
```

**v2**:
```json
{
  "robot": { "id": 1, "name": "Robot", "armor": 100 },
  "meta": { "version": 2 }
}
```

**Migration**: Update response parsing to use `robot` instead of `data`.

### 2. Authentication Header
**v1**: `Authorization: Token <token>`
**v2**: `Authorization: Bearer <token>`

**Migration**: Change header format in all API calls.

## New Features in v2
- Pagination support on all list endpoints
- Improved error messages
- Rate limiting headers
```

## API Documentation

### Document All Versions

**OpenAPI/Swagger Spec**:
```yaml
openapi: 3.0.0
info:
  title: Armoured Souls API
  version: 2.0.0
servers:
  - url: https://api.armouredsouls.com/v2
    description: Production v2
  - url: https://api.armouredsouls.com/v1
    description: Production v1 (deprecated)
paths:
  /robots:
    get:
      summary: List robots
      deprecated: false
      responses:
        '200':
          description: Success
```

### Version-Specific Documentation

**Separate Docs Per Version**:
- `/docs/api/v1/` - v1 documentation (marked deprecated)
- `/docs/api/v2/` - v2 documentation (current)
- `/docs/api/migration/` - Migration guides

## Testing Across Versions

### Test Both Versions

**Integration Tests**:
```typescript
describe('API v1 (deprecated)', () => {
  it('should return robots in v1 format', async () => {
    const response = await request(app).get('/api/v1/robots');
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('data');
  });
});

describe('API v2', () => {
  it('should return robots in v2 format', async () => {
    const response = await request(app).get('/api/v2/robots');
    expect(response.body).toHaveProperty('robots');
    expect(response.body).toHaveProperty('meta');
  });
});
```

## Checklist

### Before Making Breaking Changes
- [ ] Documented all breaking changes
- [ ] Created migration guide
- [ ] Implemented new version
- [ ] Added deprecation warnings to old version
- [ ] Set sunset date (minimum 6 months)
- [ ] Updated API documentation
- [ ] Communicated to users
- [ ] Set up usage monitoring

### During Deprecation Period
- [ ] Monitor deprecated endpoint usage
- [ ] Contact heavy users of deprecated API
- [ ] Provide support for migration
- [ ] Send periodic reminders about sunset date
- [ ] Keep both versions functional

### After Sunset Date
- [ ] Remove deprecated endpoints
- [ ] Return 410 Gone for removed endpoints
- [ ] Update documentation
- [ ] Archive old version documentation
- [ ] Monitor for issues
