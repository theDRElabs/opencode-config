# Manual QA Fixture Issue

Outcome: a signed-in editor can inspect seeded field notes and open a new-note flow.

Acceptance criteria:
- primary seeded notes are visible and searchable;
- empty, loading, error, and forbidden states are understandable;
- editor and viewer permissions are distinguishable;
- unauthorized state overrides requested roles, exposes no protected note data, and server-side note/editor endpoints return 403;
- desktop and mobile layouts remain usable without horizontal overflow;
- browser failures are captured as evidence;
- human visual and product acceptance remains explicitly unautomated.
