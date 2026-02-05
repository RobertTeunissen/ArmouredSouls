# Troubleshooting: Prisma Client Out of Sync

## The Problem

You might encounter this error when running the application:

```
PrismaClientValidationError: Unknown argument `fieldName`. Available options are marked with ?.
```

This error occurs when the Prisma client (generated TypeScript types and runtime code) is out of sync with your database schema.

## Common Scenarios

This typically happens when:

1. **After pulling schema changes** - Someone added a field to `schema.prisma` and you pulled their changes
2. **After running migrations** - A migration added a field but the client wasn't regenerated
3. **After switching branches** - Different branches may have different schema versions
4. **In CI/CD pipelines** - Build process doesn't include Prisma client generation

## Quick Fix

Run these commands in the `prototype/backend` directory:

```bash
# Ensure dependencies are installed
npm install

# Regenerate Prisma client
npm run prisma:generate
```

That's it! The Prisma client will now be in sync with your schema.

## What Does `prisma generate` Do?

The `prisma generate` command:
- Reads your `prisma/schema.prisma` file
- Generates TypeScript types for all your models
- Creates a type-safe Prisma Client with methods for each model
- Outputs to `node_modules/@prisma/client/`

## When Do You Need to Run It?

Run `npm run prisma:generate` whenever:
- ✅ You add/remove/modify fields in `schema.prisma`
- ✅ You create or apply a migration
- ✅ You pull schema changes from git
- ✅ You switch branches with different schemas
- ✅ After `npm install` if you encounter Prisma errors

## Verifying the Fix

You can verify the Prisma client is up-to-date by:

1. **Check the generated types:**
   ```bash
   grep "yourFieldName" node_modules/.prisma/client/index.d.ts
   ```

2. **Build the TypeScript code:**
   ```bash
   npm run build
   ```
   
   If there are no errors related to Prisma fields, the client is in sync.

3. **Run tests:**
   ```bash
   npm test
   ```

## Real Example: cyclesInCurrentLeague Field

In cycle 10, we encountered this error:

```
Unknown argument `cyclesInCurrentLeague`. Available options are marked with ?.
```

**Investigation:**
- ✅ Field exists in `schema.prisma` (line 127)
- ✅ Migration exists: `20260205193846_add_cycles_in_current_league`
- ✅ Migration was applied to database
- ❌ Prisma client wasn't regenerated

**Solution:**
```bash
cd prototype/backend
npm install
npm run prisma:generate
```

**Result:** Error resolved! The field is now recognized by the Prisma client.

## Best Practices

### For Developers

1. **After schema changes**, always run:
   ```bash
   npm run prisma:migrate dev  # Creates and applies migration
   npm run prisma:generate     # Updates client (usually automatic)
   ```

2. **After pulling changes**, check if schema was modified:
   ```bash
   git diff main -- prisma/schema.prisma
   ```
   If schema changed, run `npm run prisma:generate`

3. **Commit checklist** - Before committing schema changes:
   - [ ] Migration created and tested
   - [ ] Prisma client regenerated locally
   - [ ] Code compiles: `npm run build`
   - [ ] Tests pass: `npm test`

### For CI/CD

Your CI/CD pipeline should include:

```bash
npm install              # Installs dependencies
npm run prisma:generate  # Generates client
npm run build           # Builds TypeScript
npm test               # Runs tests
```

Consider adding a `postinstall` script in `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

This automatically runs `prisma generate` after every `npm install`.

## Still Having Issues?

1. **Clean reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run prisma:generate
   ```

2. **Check schema syntax:**
   ```bash
   npx prisma validate
   ```

3. **View generated client location:**
   ```bash
   ls -la node_modules/.prisma/client/
   ```

4. **Check Prisma version:**
   ```bash
   npx prisma --version
   ```

## Related Documentation

- [Prisma Client API](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Project SETUP.md](../../docs/SETUP.md) - Initial setup guide
- [TROUBLESHOOTING.md](../../docs/reference_docs/TROUBLESHOOTING.md) - General troubleshooting

## Summary

**TL;DR:** If you see "Unknown argument" errors from Prisma, run:
```bash
npm run prisma:generate
```

This regenerates the Prisma client to match your current schema.
