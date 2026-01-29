# Contributing to Armoured Souls

Thank you for your interest in contributing to Armoured Souls! This document provides guidelines and best practices for contributing to the project.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Coding Standards](#coding-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Commit Message Guidelines](#commit-message-guidelines)
8. [Pull Request Process](#pull-request-process)
9. [Documentation](#documentation)
10. [Security](#security)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and considerate in all interactions.

### Standards

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

---

## Getting Started

### Prerequisites

- Git
- Node.js (v18+) or Python (3.10+) - TBD based on tech stack decision
- Docker (for local database)
- Code editor (VS Code recommended)

### First Contribution

1. **Find an Issue**: Look for issues labeled `good-first-issue` or `help-wanted`
2. **Ask Questions**: Comment on the issue if you need clarification
3. **Fork & Clone**: Fork the repository and clone it locally
4. **Create Branch**: Create a feature branch for your work
5. **Make Changes**: Implement your changes following our guidelines
6. **Test**: Ensure all tests pass
7. **Submit PR**: Submit a pull request for review

---

## Development Setup

```bash
# Clone the repository
git clone https://github.com/RobertTeunissen/ArmouredSouls.git
cd ArmouredSouls

# Install dependencies (exact commands TBD based on tech stack)
npm install  # or: pip install -r requirements.txt

# Set up local database
docker-compose up -d

# Run migrations
npm run migrate  # or: python manage.py migrate

# Start development server
npm run dev  # or: python manage.py runserver

# Run tests
npm test  # or: pytest
```

---

## Project Structure

```
ArmouredSouls/
├── docs/               # Project documentation
├── modules/            # Application modules
│   ├── auth/          # Authentication module
│   ├── game-engine/   # Core game logic
│   ├── robot/         # Robot management
│   ├── battle/        # Battle simulation
│   └── ...            # Other modules
├── tests/             # Test suites
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── e2e/           # End-to-end tests
└── scripts/           # Utility scripts
```

See [MODULE_STRUCTURE.md](docs/MODULE_STRUCTURE.md) for detailed module documentation.

---

## Coding Standards

### General Principles

- **DRY**: Don't Repeat Yourself
- **KISS**: Keep It Simple, Stupid
- **YAGNI**: You Aren't Gonna Need It
- **SOLID**: Follow SOLID principles
- **Clean Code**: Write self-documenting code

### Code Style

#### TypeScript/JavaScript
- Use **TypeScript** for type safety
- Follow **Airbnb Style Guide**
- Use **ESLint** and **Prettier**
- Prefer `const` over `let`, never use `var`
- Use meaningful variable names
- Max line length: 100 characters

```typescript
// Good
const calculateRobotDamage = (attacker: Robot, defender: Robot): number => {
  const baseDamage = attacker.attack - defender.defense;
  return Math.max(baseDamage, 0);
};

// Bad
function calc(a: any, d: any) {
  return a.att - d.def;
}
```

#### Python
- Follow **PEP 8** style guide
- Use **Black** for formatting
- Use **mypy** for type checking
- Use type hints
- Max line length: 88 characters (Black default)

```python
# Good
def calculate_robot_damage(attacker: Robot, defender: Robot) -> int:
    """Calculate damage dealt by attacker to defender."""
    base_damage = attacker.attack - defender.defense
    return max(base_damage, 0)

# Bad
def calc(a, d):
    return a.att - d.def
```

### File Naming

- **TypeScript/JavaScript**: `camelCase.ts` or `PascalCase.tsx` (components)
- **Python**: `snake_case.py`
- **Tests**: `*.test.ts` or `test_*.py`

### Directory Naming

- Use `kebab-case` for directories: `game-engine`, `robot-management`

---

## Testing Guidelines

### Test Coverage Requirements

- **Overall**: >80% code coverage
- **Critical modules** (auth, battle, payment): >90%
- **New code**: >85%

### Testing Pyramid

```
E2E Tests (10%)      ← Few, slow, high-level
Integration (30%)    ← Medium count and speed
Unit Tests (60%)     ← Many, fast, focused
```

### Writing Tests

#### Unit Tests

```typescript
describe('RobotService', () => {
  describe('calculateDamage', () => {
    it('should calculate damage correctly', () => {
      // Arrange
      const attacker = createRobot({ attack: 100 });
      const defender = createRobot({ defense: 30 });
      
      // Act
      const damage = calculateDamage(attacker, defender);
      
      // Assert
      expect(damage).toBe(70);
    });
    
    it('should not deal negative damage', () => {
      const attacker = createRobot({ attack: 10 });
      const defender = createRobot({ defense: 50 });
      
      const damage = calculateDamage(attacker, defender);
      
      expect(damage).toBe(0);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test robot.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode (for TDD)
npm test -- --watch
```

---

## Commit Message Guidelines

We follow **Conventional Commits** specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes

### Examples

```
feat(robot): add damage calculation system

Implement damage calculation based on attack and defense stats.
Includes defense penetration and critical hit mechanics.

Closes #123
```

```
fix(auth): prevent token expiration edge case

Fixed issue where tokens could be used briefly after expiration
due to clock skew between servers.

Fixes #456
```

```
docs(api): update robot API documentation

- Add missing parameters
- Fix example responses
- Update error codes
```

### Rules

- Use imperative mood ("add" not "added")
- Don't capitalize first letter
- No period at the end
- Reference issues/PRs in footer
- Keep subject line under 72 characters

---

## Pull Request Process

### Before Submitting

1. ✅ **Code compiles** without errors
2. ✅ **All tests pass** locally
3. ✅ **Linting passes** (no warnings)
4. ✅ **Code formatted** (Prettier/Black)
5. ✅ **Documentation updated** (if applicable)
6. ✅ **Tests added** for new features
7. ✅ **Security scan clean** (no new vulnerabilities)

### PR Checklist

When submitting a PR, ensure:

- [ ] Title follows conventional commit format
- [ ] Description clearly explains what and why
- [ ] Screenshots included (for UI changes)
- [ ] Breaking changes documented
- [ ] Issue linked (Closes #123)
- [ ] Tests added/updated
- [ ] Documentation updated

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)
Add screenshots here

## Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests pass
```

### Review Process

1. **Automated Checks**: CI/CD must pass
2. **Code Review**: At least one approval required
3. **Address Feedback**: Make requested changes
4. **Merge**: Squash and merge to main

---

## Documentation

### Code Documentation

#### TypeScript/JavaScript (JSDoc)
```typescript
/**
 * Calculate damage dealt by attacker to defender.
 * 
 * @param attacker - The attacking robot
 * @param defender - The defending robot
 * @returns The amount of damage dealt
 * @throws {Error} If robots are invalid
 * 
 * @example
 * const damage = calculateDamage(myRobot, enemyRobot);
 */
function calculateDamage(attacker: Robot, defender: Robot): number {
  // Implementation
}
```

#### Python (Docstring)
```python
def calculate_damage(attacker: Robot, defender: Robot) -> int:
    """
    Calculate damage dealt by attacker to defender.
    
    Args:
        attacker: The attacking robot
        defender: The defending robot
        
    Returns:
        The amount of damage dealt
        
    Raises:
        ValueError: If robots are invalid
        
    Example:
        >>> damage = calculate_damage(my_robot, enemy_robot)
        70
    """
    # Implementation
```

### Module Documentation

Each module should have:
- `README.md` - Overview and quick start
- `API.md` - Detailed API documentation
- `TESTS.md` - Testing guide

---

## Security

### Reporting Vulnerabilities

**DO NOT** open a public issue for security vulnerabilities.

Instead, email: **security@armouredsouls.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Security Best Practices

- Never commit secrets or credentials
- Use environment variables for configuration
- Validate all user input
- Use parameterized queries (prevent SQL injection)
- Implement proper authentication and authorization
- Keep dependencies up to date
- Follow principle of least privilege

---

## Branch Naming

- **Feature**: `feature/add-robot-customization`
- **Bug Fix**: `fix/authentication-token-expiry`
- **Documentation**: `docs/update-api-docs`
- **Refactor**: `refactor/database-queries`

---

## License

By contributing to Armoured Souls, you agree that your contributions will be licensed under the project's license.

---

## Questions?

- Review [ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details
- Open a discussion on GitHub
- Reach out to maintainers

---

## Thank You! 🎉

Your contributions make Armoured Souls better for everyone. We appreciate your time and effort!