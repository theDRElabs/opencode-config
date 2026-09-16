
ISSUE-002: Add in-app validation card for accuracy attribution
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: with a Settings toggle enabled, the dashboard shows a card comparing
  "NSM raw total today" vs "sum of logged ticks" plus the delta, so a mismatch
  vs Android Settings is attributable (our sampling vs system-level)
ACCEPTANCE:
- Card is hidden unless its persisted Settings toggle is enabled
- Card shows NSM raw mobile total today, sum of logged tick rows today, and
  the delta (human-readable units)
- Card renders a visible error state when the NSM query fails
- Comparison/delta logic is unit-tested (TDD: red before implementation)
- UI makes no direct NetworkStatsManager/UsageStatsManager calls; new query
  goes through the sampling engine
LAYERS: data+ui
MODULES: sampling engine gains a raw-today-total query; SettingsScreen gains
  the toggle; DashboardScreen gains the card; exact names follow existing
  conventions
TESTS: unit tests for delta computation and toggle-gated visibility logic
COMMANDS: CI only — `testDebugUnitTest` + `lint` via the existing workflow
  (no local builds)
CONSTRAINTS: no Room schema changes; no new permissions; card is read-only
  diagnostics and never mutates stored rows; locked decisions unchanged
NON-GOALS: full diagnostics screen, manual entry of the Settings figure,
  CSV-based comparison tooling

