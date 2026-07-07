# Releasing

The npm version and the GitHub tag always come from the same command, so they
can't drift: `npm version` bumps `package.json`, commits, and creates the
matching `vX.Y.Z` git tag in one atomic step. The `postversion` script then
pushes the commit and tag to GitHub automatically.

## Cutting a release

From a clean working tree on `main`:

```sh
# 1. Bump the version — pick one. Creates the commit + vX.Y.Z tag and pushes.
npm version patch   # 0.1.0 -> 0.1.1  (fixes)
npm version minor   # 0.1.0 -> 0.2.0  (new features)
npm version major   # 0.1.0 -> 1.0.0  (breaking changes)

# 2. Publish to npm. prepublishOnly runs typecheck + the vendored p5.brush
#    test suite + a fresh library build first, so a broken or stale dist
#    can never ship.
npm publish

# 3. Create the GitHub Release from the tag that step 1 pushed.
gh release create vX.Y.Z --generate-notes
```

After this, `npm view brushmark version`, the `vX.Y.Z` tag, and the GitHub
Release all show the same version.

## Rules that keep the two in sync

- **Never edit `version` in `package.json` by hand** — always `npm version`,
  so the git tag is created with it.
- **Never `git tag` by hand** for releases — the tag must correspond to a
  published npm version.
- If `npm publish` fails after the tag was pushed (step 2), fix the problem
  and publish the same version — don't bump again; the tag already names it.
- Pre-releases: `npm version prerelease --preid=beta` (e.g. `0.2.0-beta.0`),
  then `npm publish --tag beta` so it doesn't become the default install.

## One-time notes

- `v0.1.0` was tagged retroactively on the initial commit.
- Optional future upgrade: a GitHub Actions workflow that runs `npm publish`
  whenever a `v*` tag is pushed (requires an `NPM_TOKEN` repo secret or npm
  [trusted publishing](https://docs.npmjs.com/generating-provenance-statements)),
  which reduces the release to `npm version …` + `gh release create`.
