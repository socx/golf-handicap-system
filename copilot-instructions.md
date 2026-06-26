# Copilot Instructions
ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Repository Organization
The project implements golf handicap tracking and scoring. The repository is organized into the following main directories:
- `apps/`: Contains the main applications, including:
  - `web/`: The frontend application built with React.
  - `api/`: The backend API built with Node.js and Express.
- `docs/`: Contains documentation, including architecture diagrams and deployment runbooks.
- `scripts/`: Contains utility scripts for deployment and maintenance.  

## Requirements
The requirements organisaed into epics and stories are documented in the `product-management/stories/` directory. Each story includes:
- A description of the user story.
- Acceptance criteria.
- Dependencies. 


## Working Effectively
Bootstrap and build the repository:

Dependencies: Node.js (check with node --version), npm (check with npm --version)
`npm install` -- installs dependencies.
`npm run build` -- builds all packages. 

**Run tests:**

`npm test` -- runs unit tests. NEVER CANCEL.
`npm run type-check` -- runs TypeScript type checking across all packages. 

**Linting and formatting:**

`npm run lint` -- lints JavaScript/TypeScript/Markdown. 

## Validation Scenarios

**Always validate your changes by:**

1. Building the project: `npm run build` (ensures TypeScript compilation succeeds)
2. Running tests: `npm test` (ensures code behavior works correctly)
3. Type checking: `npm run type-check` (ensures TypeScript types are correct)
4. Linting: `npm run lint`

**Before committing:**

- Always run `npm run format` before committing or CI will fail
- Run `npm run lint:fix` to auto-fix linting issues
- Ensure `npm run build` succeeds without errors

## Committing Guidelines
 - Commit separately for each story or feature.
 - Use clear commit messages with prefixes: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`.
 - Avoid committing broken code or failing tests.
 - Prepend commit messages with the story number if applicable, e.g., `#88: feat(web): add new API endpoint`.

**After committing:**
- Update the corresponding Github issue with the commit hash and a brief description of the change. then close the issue if the story is complete.

## CI/CD and Workflows

**Key GitHub Actions:**

- `.github/workflows/ci.yml` -- Main CI pipeline (lint, test, type-check, build)
- `.github/workflows/vrt.yml` -- Visual regression testing
- `.github/workflows/storybook-tests.yml` -- Storybook interaction tests

**The CI will fail if:**

- Type-check errors exist
- Linting errors exist 
- TypeScript compilation fails
- Tests fail
- Build fails
