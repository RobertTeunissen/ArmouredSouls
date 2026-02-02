# Frontend Setup Troubleshooting

## Error: Cannot find package 'vite-plugin-svgr'

### Problem
After pulling the latest navigation menu updates, you may see this error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'vite-plugin-svgr' imported from vite.config.ts
```

### Root Cause
The navigation menu overhaul added a new dependency (`vite-plugin-svgr`) that needs to be installed.

### Solution

Run the following command from the `prototype/frontend` directory:

```bash
cd prototype/frontend
npm install
```

This will install all dependencies listed in `package.json`, including the new `vite-plugin-svgr` package.

### Verification

After running `npm install`, you should be able to start the dev server:

```bash
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in XXX ms
  
  ➜  Local:   http://localhost:3000/
```

## Why This Happens

When you pull changes from Git that include updates to `package.json`, you need to run `npm install` to download and install any new dependencies. The `node_modules` directory is not tracked in Git (it's in `.gitignore`), so new packages need to be installed manually.

## General Rule

**After pulling changes that modify `package.json`, always run:**

```bash
npm install
```

This applies to both frontend and backend directories.
