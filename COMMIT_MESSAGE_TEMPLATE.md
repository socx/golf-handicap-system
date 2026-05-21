# Commit Message Template

Use an issue-first commit title:

```text
#<issue-number> <type>(<scope>): <short summary>
```

If no scope is useful, omit it:

```text
#<issue-number> <type>: <short summary>
```

## Recommended Types

- `feat` — new functionality
- `fix` — bug fix
- `chore` — setup, tooling, scaffolding
- `docs` — documentation-only change
- `refactor` — internal restructuring without behavior change
- `test` — tests only
- `ci` — CI/CD or workflow changes

## Suggested Template

```text
#<issue-number> <type>(<scope>): <short summary>

- what changed
- why it changed
- follow-up notes if needed
```

## Examples

```text
#309 chore(devops): scaffold local API and web bootstrap

- add apps/api and apps/web starter servers
- add .env.example and version checks
- align local ports with ghs_api and ghs_web runtime
```

```text
#296 feat(auth): add login and refresh endpoints
```

```text
#318 docs(architecture): align spec to single REST API design
```

```text
#310 fix(security): enforce auth rate limiting on login routes
```

## Guidance

- Prefer one primary issue per commit.
- If a commit touches multiple issues, use the dominant issue in the title.
- Keep the subject line short and action-oriented.
- Use the body for context, rationale, and follow-up notes.
