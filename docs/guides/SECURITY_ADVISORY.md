# Security Advisory - February 8, 2026

## Critical Security Fix

### Issue: .env File Was Tracked in Git

**Severity**: 🔴 **CRITICAL**

**Description**: The `.env` file containing sensitive configuration was accidentally tracked in the git repository. This file was removed from tracking in commit [current].

**Impact**: 
- Database credentials were exposed in git history
- JWT secret was exposed in git history
- Anyone with access to the repository history could see these credentials

**Resolution**:
1. ✅ Removed `.env` from git tracking
2. ✅ Verified `.gitignore` is properly configured
3. ⚠️ **ACTION REQUIRED**: Change the following in production:
   - Database password
   - JWT secret
   - Any other secrets that were in the tracked `.env` file

**Git History Cleanup** (Optional but Recommended):
To completely remove the `.env` file from git history:
```bash
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch prototype/backend/.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push (WARNING: This rewrites history)
git push origin --force --all
```

**Prevention**:
- Always verify `.env` files are in `.gitignore` before first commit
- Use `git check-ignore <file>` to verify files are ignored
- Consider using pre-commit hooks to prevent sensitive files from being committed

---

## Dependency Vulnerabilities

### Backend (High Severity)

**Package**: `tar` (≤7.5.6) - via `@mapbox/node-pre-gyp` → `bcrypt`

**Issues**:
1. Arbitrary File Overwrite and Symlink Poisoning (GHSA-8qq5-rm4j-mr97)
2. Race Condition in Path Reservations (GHSA-r6q2-hw4h-h46w)
3. Arbitrary File Creation via Hardlink Traversal (GHSA-34x7-hfp2-rc4v)

**Risk Assessment**: 🟡 **MODERATE**
- Affects local development environment only
- Not exposed in production API
- Used only during bcrypt installation

**Remediation**:
```bash
cd prototype/backend
npm audit fix
```

If automatic fix doesn't work:
```bash
npm update bcrypt
# or
npm install bcrypt@latest
```

**Alternative**: Consider switching to `argon2` for password hashing if bcrypt continues to have dependency issues.

### Frontend (Moderate Severity)

**Status**: 2 moderate severity vulnerabilities detected

**Remediation**:
```bash
cd prototype/frontend
npm audit fix
```

---

## Security Best Practices Implemented

### ✅ Environment Variables
- All secrets use `process.env` variables
- `.env.example` provided with dummy values
- `.env` properly gitignored (after fix)

### ✅ Authentication
- JWT-based authentication
- bcrypt password hashing (10 rounds)
- Authentication middleware on protected routes

### ✅ Database Security
- Prisma ORM with parameterized queries (SQL injection protection)
- Connection string in environment variables

### ✅ API Security
- CORS configured
- Input validation on routes
- Error messages don't expose internal details

---

## Security Checklist for Developers

### Before Committing
- [ ] No hardcoded secrets or API keys
- [ ] No `.env` files being committed
- [ ] No database credentials in code
- [ ] No commented-out secrets

### Regular Maintenance
- [ ] Run `npm audit` monthly
- [ ] Update dependencies quarterly
- [ ] Review and rotate secrets annually
- [ ] Monitor security advisories for used packages

### Production Deployment
- [ ] Use strong, unique JWT secret
- [ ] Use strong, unique database password
- [ ] Enable HTTPS/TLS
- [ ] Set secure cookie flags
- [ ] Configure CORS properly for production domain
- [ ] Enable rate limiting
- [ ] Set up monitoring and alerting

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. **DO NOT** commit fixes to public branches
3. Contact the project owner privately
4. Provide detailed information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

---

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [npm audit Documentation](https://docs.npmjs.com/cli/v9/commands/npm-audit)

---

**Last Updated**: February 8, 2026  
**Next Review**: March 8, 2026
