---
inclusion: always
---

# Dependency Management

## Adding New Dependencies

### Evaluation Criteria

**Before Adding a Dependency, Consider**:
1. **Necessity**: Can this be implemented in-house reasonably?
2. **Maintenance**: Is the package actively maintained?
3. **Security**: Are there known vulnerabilities?
4. **Size**: What is the bundle size impact?
5. **License**: Is the license compatible with project?
6. **Popularity**: Is it widely used and trusted?
7. **Dependencies**: How many transitive dependencies?

### Evaluation Process

**Check Package Health**:
```bash
# View package info
npm info <package-name>

# Check for vulnerabilities
npm audit

# View dependency tree
npm ls <package-name>
```

**Key Indicators**:
- Last publish date (< 6 months is good)
- Weekly downloads (higher is better)
- Open issues vs closed issues ratio
- GitHub stars and forks
- TypeScript support
- Test coverage

### When to Add Dependencies

**Good Reasons**:
- Complex functionality (authentication, payment processing)
- Industry-standard solutions (Prisma, Express, React)
- Significant time savings vs implementation cost
- Well-maintained and widely adopted
- Security-critical functionality (bcrypt, jsonwebtoken)

**Bad Reasons**:
- Simple utility functions (use lodash selectively or write own)
- Unmaintained packages
- Packages with known vulnerabilities
- Excessive bundle size for minimal functionality
- Packages with many dependencies


## Installing Dependencies

### Production Dependencies

**Install with npm**:
```bash
cd prototype/backend
npm install <package-name>

# Or with specific version
npm install <package-name>@1.2.3
```

**Document in Code**:
```typescript
// Add comment explaining why dependency is needed
import bcrypt from 'bcrypt'; // Password hashing (security requirement)
import express from 'express'; // Web framework
```

### Development Dependencies

**Install as devDependency**:
```bash
npm install --save-dev <package-name>

# Examples
npm install --save-dev @types/node
npm install --save-dev jest
npm install --save-dev eslint
```

### Peer Dependencies

**Handle peer dependency warnings**:
- Install required peer dependencies
- Document version compatibility
- Test thoroughly after installation

## Updating Dependencies

### Update Strategy

**Regular Updates** (monthly):
- Patch versions (1.2.3 → 1.2.4): Low risk, bug fixes
- Minor versions (1.2.0 → 1.3.0): Medium risk, new features
- Major versions (1.0.0 → 2.0.0): High risk, breaking changes

### Update Process

**Check for Updates**:
```bash
# View outdated packages
npm outdated

# Update all patch and minor versions
npm update

# Update specific package
npm update <package-name>
```

**Update Major Versions**:
```bash
# Install specific major version
npm install <package-name>@latest

# Review changelog
npm info <package-name> versions
```

### Testing After Updates

**Required Testing**:
1. Run full test suite: `npm test`
2. Check for TypeScript errors: `npx tsc --noEmit`
3. Test critical user flows manually
4. Check for console errors/warnings
5. Verify build succeeds: `npm run build`

### Handling Breaking Changes

**When Major Version Updates Break Code**:
1. Read migration guide in package documentation
2. Update code to match new API
3. Update tests to reflect changes
4. Document breaking changes in commit message
5. Update relevant documentation


## Security Management

### Vulnerability Scanning

**Regular Security Audits**:
```bash
# Check for vulnerabilities
npm audit

# View detailed report
npm audit --json

# Fix automatically (if possible)
npm audit fix

# Fix including breaking changes
npm audit fix --force
```

### Handling Vulnerabilities

**Severity Levels**:
- **Critical**: Fix immediately, may require hotfix
- **High**: Fix within 1 week
- **Moderate**: Fix within 1 month
- **Low**: Fix in next regular update cycle

**Resolution Process**:
1. Identify vulnerable package
2. Check if update available
3. Update to patched version
4. If no patch available, consider alternatives
5. Document decision if vulnerability accepted temporarily

### Security Best Practices

**Do's**:
- Run `npm audit` before every deployment
- Keep dependencies up to date
- Use exact versions in package.json for critical packages
- Review security advisories for used packages
- Use npm's two-factor authentication

**Don'ts**:
- Ignore security warnings
- Use packages with known critical vulnerabilities
- Install packages from untrusted sources
- Commit package-lock.json conflicts without resolving

## Package.json Management

### Version Pinning

**Semantic Versioning**:
```json
{
  "dependencies": {
    "express": "4.18.2",        // Exact version (pinned)
    "prisma": "^5.0.0",         // Compatible with 5.x.x
    "react": "~18.2.0"          // Compatible with 18.2.x
  }
}
```

**When to Pin Versions**:
- Production dependencies with breaking change history
- Packages affecting security
- Packages with unstable APIs
- Critical infrastructure packages

**When to Use Ranges**:
- Development dependencies
- Well-maintained stable packages
- Packages following semantic versioning strictly

### Scripts Organization

**Standard Scripts**:
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  }
}
```


## Common Dependencies

### Backend Core
- **express**: Web framework
- **prisma**: Database ORM
- **bcrypt**: Password hashing
- **jsonwebtoken**: JWT authentication
- **zod**: Schema validation
- **winston**: Logging

### Backend Development
- **typescript**: Type system
- **tsx**: TypeScript execution
- **jest**: Testing framework
- **@types/node**: Node.js type definitions
- **eslint**: Code linting
- **prettier**: Code formatting

### Frontend Core
- **react**: UI framework
- **react-router-dom**: Routing
- **axios**: HTTP client
- **tailwindcss**: CSS framework

### Frontend Development
- **vite**: Build tool
- **@types/react**: React type definitions
- **eslint**: Code linting
- **prettier**: Code formatting

## Troubleshooting

### Dependency Conflicts

**Resolve Version Conflicts**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Force resolution (use cautiously)
npm install --legacy-peer-deps
```

### Missing Dependencies

**Fix Missing Dependencies**:
```bash
# Install all dependencies
npm install

# Regenerate lock file
rm package-lock.json
npm install
```

### Build Failures After Update

**Debug Build Issues**:
1. Check TypeScript errors: `npx tsc --noEmit`
2. Check for breaking changes in updated packages
3. Review package changelogs
4. Revert problematic update if needed
5. Fix code to match new API

## Checklist

### Before Adding Dependency
- [ ] Evaluated necessity and alternatives
- [ ] Checked package maintenance status
- [ ] Verified no security vulnerabilities
- [ ] Assessed bundle size impact
- [ ] Confirmed license compatibility
- [ ] Documented reason for addition

### Before Updating Dependencies
- [ ] Reviewed changelogs for breaking changes
- [ ] Backed up current working state
- [ ] Updated one package at a time (for major versions)
- [ ] Ran full test suite after update
- [ ] Tested critical functionality manually
- [ ] Committed updates separately from feature work

### Regular Maintenance
- [ ] Run `npm audit` weekly
- [ ] Update patch versions monthly
- [ ] Review and update minor versions quarterly
- [ ] Plan major version updates carefully
- [ ] Keep package.json and lock file in sync
- [ ] Document significant dependency changes
