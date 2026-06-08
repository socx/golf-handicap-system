# API Modules

This folder is reserved for feature-oriented modules that encapsulate HTTP-facing and domain-facing logic per feature area.

Current route handlers under `src/routes/` already represent module boundaries (auth, players, rounds, courses, handicap, admin).
Future refactors can move each feature into subfolders here with controllers/services/repositories/schemas.
