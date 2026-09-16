---
description: Run the weekly transcript-reading ritual over new agent runs.
agent: build
---

Open `/home/DRE/.config/opencode/WEEKLY-REVIEW.md` and follow it exactly.

1. List the week's new runs (files newer than the last-review marker):

   find /home/DRE/.config/opencode/runs/ -newer /home/DRE/.config/opencode/runs/.last-weekly-review -type f

2. Read the transcripts in priority order from WEEKLY-REVIEW.md, starting with the
   newest `ISSUE-*/attempt-*/review.md` and the milestone `events.jsonl`.
3. Write the dated Improvement Log entry in `HARNESS-METRICS.md`, ending with the
   required audit line:
   `review: date=... transcripts_read=... findings=... cases_created=... proposed=...`
4. Hand fixture-case candidates to the Phase 20 intake pipeline
   (`fixtures/_intake/`).
5. Refresh the marker: `touch /home/DRE/.config/opencode/runs/.last-weekly-review`.

Request:
$ARGUMENTS