# Armoured Souls - Security Strategy

**Last Updated**: January 24, 2026

## Security First Approach

Security is a core principle of Armoured Souls. This document outlines our comprehensive security strategy across all layers of the application.

## Security Principles

### 1. Defense in Depth
Multiple layers of security controls throughout the system:
- Network security
- Application security  
- Data security
- Access control

### 2. Principle of Least Privilege
Users and services have only the minimum permissions required to perform their functions.

### 3. Zero Trust Architecture
Never trust, always verify. All requests are authenticated and authorized.

### 4. Security by Design
Security considerations are built into the architecture from the start, not added as an afterthought.

---

## Authentication & Authorization

### Authentication Mechanisms

#### Primary: JWT (JSON Web Tokens)
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Secure token storage (httpOnly cookies or secure storage)
- Token rotation on refresh

#### Multi-Factor Authentication (MFA)
- TOTP (Time-based One-Time Password)
- SMS backup option
- Recovery codes

#### OAuth 2.0 Integration
- Support for Google, Facebook, Apple sign-in
- Proper scope management
- Secure token handling

### Authorization Model

#### Role-Based Access Control (RBAC)
**Roles**:
- `guest` - Unauthenticated users (very limited)
- `user` - Standard registered players
- `premium` - Paid subscribers (enhanced features)
- `moderator` - Content moderators
- `admin` - System administrators

**Permission Categories**:
- Player management (own profile)
- Robot management (own robots)
- Battle participation
- Admin functions
- Moderation actions

#### Resource-Level Permissions
- Players can only access/modify their own resources
- Battle participants can only view battles they're part of
- Admins can access all resources (with audit logging)

---

## Data Security

### Encryption

#### Data at Rest
- Database encryption using provider's native encryption (e.g., AWS RDS encryption)
- Encrypted backups
- Encrypted file storage (S3 with SSE)

#### Data in Transit
- TLS 1.3 for all connections
- HTTPS enforced (HSTS headers)
- WSS (WebSocket Secure) for real-time features
- Certificate pinning for mobile apps

#### Sensitive Data
- Passwords: bcrypt with salt (cost factor 12+)
- Payment info: Never stored; use payment gateway tokens
- PII: Encrypted at field level for extra protection

### Data Privacy

#### GDPR Compliance
- User consent management
- Right to access (data export)
- Right to deletion (account deletion)
- Right to rectification
- Data minimization
- Privacy by design

#### Data Retention
- Active user data: Retained while account is active
- Inactive accounts: Warning after 1 year, deletion after 2 years
- Logs: 90 days retention
- Backups: 30 days retention

---

## API Security

### Rate Limiting
- Global rate limit: 1000 requests/hour per IP
- Authenticated user: 5000 requests/hour
- Login attempts: 5 per 15 minutes
- Registration: 3 per hour per IP
- Sensitive operations: Stricter limits

### Input Validation
- Schema validation for all inputs
- Parameterized queries (prevent SQL injection)
- Input sanitization for user-generated content
- File upload validation (type, size, content)

### Output Encoding
- HTML encoding to prevent XSS
- JSON serialization safety
- Proper Content-Type headers

### CORS (Cross-Origin Resource Sharing)
- Whitelist of allowed origins
- Credentials handling
- Preflight request handling

### API Versioning
- Version in URL path (`/api/v1/...`)
- Deprecation warnings
- Minimum supported version policy

---

## Application Security

### Code Security

#### Secure Coding Practices
- Input validation at all entry points
- Output encoding at all exit points
- Proper error handling (no sensitive info in errors)
- Secure random number generation
- Safe deserialization

#### Dependency Management
- Regular dependency updates
- Automated vulnerability scanning (Snyk, Dependabot)
- Lock files for reproducible builds
- Minimize dependencies

#### Code Review
- Security-focused code reviews
- Automated static analysis (SonarQube, ESLint security rules)
- No secrets in code (use environment variables)

### Session Management
- Secure session ID generation
- Session timeout (15 minutes idle, 12 hours absolute)
- Session invalidation on logout
- Prevent session fixation
- CSRF protection (double-submit cookie or synchronizer token)

### CSRF Protection
- CSRF tokens for state-changing operations
- SameSite cookie attribute
- Origin/Referer header validation

### XSS Prevention
- Content Security Policy (CSP) headers
- Input sanitization
- Output encoding
- Avoid inline JavaScript
- Use templating engines with auto-escaping

### SQL Injection Prevention
- Parameterized queries / prepared statements
- ORM usage
- Least privilege database accounts
- Input validation

---

## Infrastructure Security

### Network Security
- VPC with private subnets
- Security groups / firewalls
- DDoS protection (CloudFlare, AWS Shield)
- WAF (Web Application Firewall)

### Server Security
- Regular OS and software updates
- Minimal installed packages
- Disable unnecessary services
- Hardened configurations
- Intrusion detection system (IDS)

### Container Security
- Base images from trusted sources
- Regular image updates
- Vulnerability scanning
- Non-root containers
- Resource limits

### Secrets Management
- Environment variables for configuration
- Secrets manager (AWS Secrets Manager, HashiCorp Vault)
- No secrets in code or logs
- Rotation of secrets
- Encrypted secrets in CI/CD

---

## Monitoring & Incident Response

### Security Monitoring
- Failed authentication attempts
- Unusual API usage patterns
- Privilege escalation attempts
- Data access anomalies
- Real-time alerting

### Logging
- Security events logging
- Access logs
- Error logs
- Audit logs for sensitive operations
- Log aggregation and analysis
- No sensitive data in logs

### Incident Response Plan
1. **Detection**: Automated monitoring and alerting
2. **Containment**: Isolate affected systems
3. **Investigation**: Root cause analysis
4. **Remediation**: Fix vulnerabilities
5. **Recovery**: Restore normal operations
6. **Post-mortem**: Learn and improve

### Backup & Recovery
- Daily automated backups
- Encrypted backups
- Offsite backup storage
- Regular recovery testing
- RPO (Recovery Point Objective): 24 hours
- RTO (Recovery Time Objective): 4 hours

---

## Security Testing

### Types of Testing
1. **Static Application Security Testing (SAST)**
   - Automated code analysis
   - Pre-commit hooks
   - CI/CD integration

2. **Dynamic Application Security Testing (DAST)**
   - Runtime security testing
   - OWASP ZAP scans
   - Penetration testing

3. **Dependency Scanning**
   - Snyk / npm audit
   - Automated PR checks
   - Regular scans

4. **Security Code Reviews**
   - Peer review with security focus
   - Checklist-based review
   - Third-party security audits

5. **Penetration Testing**
   - Annual third-party pen tests
   - Bug bounty program (future)

### Security Testing Schedule
- SAST: Every commit (automated)
- Dependency scan: Daily
- DAST: Weekly
- Code review: Every PR
- Penetration test: Annually or after major changes

---

## Compliance & Standards

### Standards & Frameworks
- **OWASP Top 10**: Address all top vulnerabilities
- **CWE/SANS Top 25**: Address most dangerous software errors
- **NIST Cybersecurity Framework**: Overall security posture
- **ISO 27001**: Information security management (future)

### Compliance Requirements
- **GDPR**: European data protection
- **CCPA**: California consumer privacy
- **COPPA**: Children's online privacy (if allowing <13 users)
- **PCI DSS**: Payment card data (via third-party processor)

---

## Mobile Security

### iOS Security
- Keychain for sensitive data storage
- App Transport Security
- Code signing
- Jailbreak detection
- Certificate pinning

### Android Security
- Android Keystore
- ProGuard/R8 obfuscation
- Root detection
- Certificate pinning
- Secure SharedPreferences

### API Communication
- Certificate pinning
- Request signing
- Encrypted payloads for sensitive data

---

## Security Checklist for Development

### Before Coding
- [ ] Threat modeling complete
- [ ] Security requirements defined
- [ ] Data classification done

### During Development
- [ ] Input validation implemented
- [ ] Authentication and authorization in place
- [ ] Secure communication (HTTPS/WSS)
- [ ] Sensitive data encrypted
- [ ] Error handling (no info leakage)
- [ ] Logging (security events)
- [ ] Dependencies up to date

### Before Deployment
- [ ] Security code review complete
- [ ] SAST scan passed
- [ ] DAST scan passed
- [ ] Dependency scan passed
- [ ] Penetration test complete (if applicable)
- [ ] Security documentation updated

### After Deployment
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Incident response plan ready
- [ ] Backup tested

---

## Security Training

### Developer Training
- Secure coding practices
- OWASP Top 10
- Security testing tools
- Incident response procedures

### Regular Updates
- Monthly security bulletins
- Quarterly security workshops
- Annual security audit

---

## Responsible Disclosure

### Vulnerability Reporting
- Dedicated security email: security@armouredsouls.com
- Bug bounty program (future consideration)
- Responsible disclosure policy
- Acknowledge and fix within SLA

### SLA for Security Issues
- **Critical**: 24 hours
- **High**: 7 days
- **Medium**: 30 days
- **Low**: 90 days

---

## Future Security Enhancements

- Blockchain for tamper-proof battle logs
- AI-based anomaly detection
- Advanced threat protection
- Biometric authentication
- Hardware security keys support