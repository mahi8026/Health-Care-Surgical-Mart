# Project Maintenance Guide

## Health Care Surgical Mart - Code Maintenance

This guide helps you keep the project clean and maintainable.

## Quick Cleanup Commands

### Using npm scripts (Recommended)

```bash
# Clean all temporary files
npm run clean

# Clean only log files
npm run clean:logs

# Clean only cache files
npm run clean:cache

# Clean only build artifacts
npm run clean:build

# Clean everything including node_modules (use with caution)
npm run clean:all
```

### Using the cleanup script (Windows)

```bash
# Run the automated cleanup script
cleanup-script.bat
```

## Regular Maintenance Tasks

### Daily

- [ ] Review and clean log files older than 7 days
- [ ] Check for any test files in root directory
- [ ] Remove temporary files (_.tmp, _.temp)

### Weekly

- [ ] Run `npm run clean:logs` to clean all logs
- [ ] Review and remove unused code
- [ ] Check for console.log statements in production code
- [ ] Update dependencies if needed

### Monthly

- [ ] Run `npm audit` to check for security vulnerabilities
- [ ] Review and update documentation
- [ ] Clean up unused npm packages
- [ ] Review .gitignore for any missing patterns

### Quarterly

- [ ] Full codebase review
- [ ] Performance audit
- [ ] Security audit
- [ ] Update all dependencies to latest stable versions

## File Organization Rules

### ✅ DO's

1. **Test Files**
   - Keep test files in `__tests__/` or `tests/` directories
   - Name test files with `.test.js` or `.spec.js` suffix
   - Never commit test files to root directory

2. **Documentation**
   - Keep main documentation in root (README.md)
   - Keep detailed docs in `docs/` directory
   - Remove temporary fix documentation after issues are resolved

3. **Logs**
   - Configure log rotation
   - Never commit log files
   - Clean logs regularly

4. **Environment Files**
   - Never commit `.env` files
   - Use `.env.example` for templates
   - Keep sensitive data secure

5. **Build Artifacts**
   - Never commit `dist/` or `build/` directories
   - Clean build artifacts before committing
   - Use `.gitignore` properly

### ❌ DON'Ts

1. **Never commit:**
   - Test files in root directory
   - Log files
   - `.env` files
   - `node_modules/`
   - Build artifacts
   - Temporary files
   - Cache files

2. **Avoid:**
   - Commented-out code (use git history instead)
   - Unused imports
   - Console.log statements in production
   - Hardcoded credentials
   - Large binary files

## Code Quality Checklist

Before committing code, ensure:

- [ ] No console.log statements (except in development)
- [ ] No commented-out code
- [ ] No unused imports
- [ ] No hardcoded values (use constants or env variables)
- [ ] All tests pass
- [ ] Code is formatted (run `npm run format`)
- [ ] Code is linted (run `npm run lint`)
- [ ] No sensitive data in code

## Automated Cleanup

### Pre-commit Hook

The project uses Husky for pre-commit hooks. It automatically:

- Runs linting on staged files
- Formats code with Prettier
- Prevents commits with errors

### CI/CD Pipeline

The CI/CD pipeline automatically:

- Runs all tests
- Checks code quality
- Builds the project
- Deploys if all checks pass

## Monitoring Project Health

### Check Project Size

```bash
# Check total project size
du -sh .

# Check node_modules size
du -sh node_modules

# Check specific directories
du -sh client/dist server/dist logs
```

### Check for Large Files

```bash
# Find files larger than 1MB
find . -type f -size +1M -not -path "*/node_modules/*"
```

### Check for Unused Dependencies

```bash
# Install depcheck
npm install -g depcheck

# Run depcheck
depcheck
```

## Troubleshooting

### Project is too large

1. Run `npm run clean:all`
2. Delete `node_modules/` in all directories
3. Run `npm install` to reinstall dependencies
4. Clean log files and build artifacts

### Git repository is too large

1. Check for large files: `git ls-files -z | xargs -0 du -h | sort -h`
2. Remove large files from history if needed
3. Use `.gitignore` to prevent future commits

### Build is slow

1. Clean cache: `npm run clean:cache`
2. Clean build artifacts: `npm run clean:build`
3. Rebuild: `npm run build`

## Best Practices

### Code Organization

```
✅ Good Structure:
src/
  components/
    Button/
      Button.jsx
      Button.test.js
      Button.module.css
  utils/
    formatters.js
    formatters.test.js

❌ Bad Structure:
src/
  Button.jsx
  Button.test.js
  test-button.js
  button-old.js
  button-backup.js
```

### Naming Conventions

- **Components**: PascalCase (e.g., `UserProfile.jsx`)
- **Utilities**: camelCase (e.g., `formatCurrency.js`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Test files**: `*.test.js` or `*.spec.js`
- **CSS modules**: `*.module.css`

### Git Commit Messages

```
✅ Good:
feat: Add expense category filter
fix: Resolve dashboard loading issue
docs: Update API documentation
refactor: Simplify authentication logic

❌ Bad:
update
fix bug
changes
wip
```

## Resources

- [Project README](./README.md)
- [Cleanup Summary](./CLEANUP_SUMMARY.md)
- [Contributing Guidelines](#contributing)

## Support

If you need help with maintenance:

- Check this guide first
- Review the README.md
- Contact the development team
- Create an issue in the repository

---

**Last Updated**: February 5, 2026
**Maintained By**: Development Team
