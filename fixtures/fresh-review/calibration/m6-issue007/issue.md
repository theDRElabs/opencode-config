ISSUE-007: Bundle tracker counts from bundle-entry time, not cycle start
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: "X left" reflects what the user actually has: bundle usage counts
  from when the user entered/reset the bundle figure, not from the
  renewal-cycle calendar start
EVIDENCE: user entered 121 MB remaining at 17:21 on 2026-09-10; app showed
  18 MB left while real balance was 63 MB. DashboardScreen.kt:297-298
  computes bundleUsed = totalsSince(cycleStart(renewalDay)) — includes
  usage from before the entry, and treats the entry as the cycle total.
OUTCOME-NOTE: user-facing semantics decision embedded here: entry means
  "this is my current remaining balance", consumed from entry time
  forward. (If the user wants cycle-total semantics instead, say so and
  this issue changes.)
ACCEPTANCE:
- Entering a bundle figure stamps an entry timestamp (persisted)
- bundleUsed counts only usage rows with tickStart >= entry timestamp
- Entering a new figure resets the baseline without touching logged rows
- UI copy makes clear the figure means "remaining as of now"
- Unit tests for the baseline logic (TDD red first); existing tests green
- No Room schema changes; no new dependencies/permissions
LAYERS: data+ui
MODULES: Prefs.kt (entry timestamp), DashboardScreen.kt (baseline
  window), SettingsScreen.kt (copy), new pure-logic unit for baseline
TESTS: JVM unit tests for entry-time baseline computation
COMMANDS: CI only — testDebugUnitTest + lint via existing workflow
CONSTRAINTS: locked decisions unchanged; commits batched for user approval
NON-GOALS: carrier zero-rating/metering differences (system-level, out of
  scope), changing renewal-day feature, F-02/F-03 fixes
```
