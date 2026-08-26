---
name: project-memorial
description: Create or revamp project AGENTS.md instructions for new and existing repositories while preserving detailed requirements in referenced project documentation. Use when creating AGENTS.md, revising AGENTS.md, defining a project contract, reducing an oversized instruction file, or setting up project guidance.
---

# Project Memorial

Create a durable, concise project contract that helps coding agents work safely
and consistently. Treat the contract as maintained project memory: preserve
decisions and requirements, remove repetition, and move details to documents
consulted when relevant.

## Operating Rules

- Act only when the user requests creation, revision, review, or planning for
  project instructions.
- Ask before editing an existing instruction file unless the user explicitly
  requested the edit.
- Inspect the repository and existing instruction files before making changes.
- Preserve user requirements and useful existing information; never delete
  information merely to meet a line target.
- Prefer the smallest correct change and use `apply_patch` for manual edits.
- Do not install dependencies, modify application code, create commits, push,
  deploy, or change system configuration unless explicitly requested.
- Never place secrets, tokens, private credentials, or sensitive personal paths
  in tracked project instructions.
- Do not invent commands, frameworks, architecture, integrations, or project
  facts. Mark unknowns as unknown or ask the user.

## Discovery

Before drafting, determine:

- Whether the repository is new, existing, empty, or a monorepo.
- Which instruction files exist: `AGENTS.md`, `CLAUDE.md`, `.claude/`,
  `CONTRIBUTING.md`, and relevant project documentation.
- The project name, purpose, users, platforms, and maturity.
- The actual or intended language, framework, package manager, and services.
- Existing run, test, lint, type-check, build, migration, and release commands.
- Architecture boundaries, sensitive data, integrations, and approval limits.
- Design, accessibility, performance, compliance, and domain-specific rules.

For an existing project, derive facts from the repository before asking about
them. For a new or empty project, ask focused questions for unknown decisions.

## Interview

Ask only the questions needed to complete the contract. Combine related
questions where possible:

1. What is the project name, purpose, and primary user?
2. What product type and platforms are targeted?
3. Which technology choices are fixed, preferred, or unknown?
4. What features or outcomes belong in the first release?
5. Are accounts, databases, sync, payments, notifications, or external APIs
   required?
6. What design direction, references, accessibility, or content rules matter?
7. Which actions always require approval?
8. What must be true for a feature or release to be complete?

Do not ask for commands that can be confirmed from manifests, scripts, or docs.

## Root Contract

Create or revise the root `AGENTS.md` as the concise, always-relevant contract.
Target 100-160 lines and keep it under 200 lines by default. Include:

- Goal, users, platforms, and product identity.
- Required supporting-document references.
- Confirmed technology stack.
- Core product and security constraints.
- Essential architecture rules.
- Confirmed commands, or an explicit statement that commands are not known yet.
- Development workflow.
- Approval-required actions and Git rules.
- Definition of done.

Write concrete, verifiable rules. Avoid essays, duplicate requirements, and
facts that the repository already makes obvious.

## Preserve Detail

Never throw away information only because the root file is too long. Move
detailed content into project-local documents and link them from `AGENTS.md`.
Prefer these documents when applicable:

- `docs/product-requirements.md`: features, user flows, accounts, sync,
  monetization, and domain rules.
- `docs/design-and-ux.md`: visual direction, design system, responsive states,
  accessibility, and interaction requirements.
- `docs/engineering-and-quality.md`: architecture, privacy, security,
  testing, project structure, and quality gates.
- `docs/testing.md`: detailed test matrix and verification procedures.
- `docs/security.md`: threat model, data handling, and operational controls.

Reuse existing documentation instead of duplicating it. Create a new document
only when the information has no suitable home. Supporting documents should be
focused, named clearly, and referenced by relative path from `AGENTS.md`.

For large repositories, use nested `AGENTS.md` files or path-scoped rules for
genuinely local subsystem guidance. Do not create nested files merely to split
an otherwise small contract.

## New Projects

For an empty repository:

1. Ask only the necessary discovery questions.
2. Mark unconfirmed commands as unknown; do not list imagined scripts as facts.
3. Record chosen stack and constraints as provisional when appropriate.
4. Create the root contract and only the supporting documents that preserve
   meaningful detail.
5. Do not scaffold code, install dependencies, or alter tooling unless asked.

## Existing Projects and Revamps

Before revising an existing contract:

- Read it completely and inspect Git status and relevant docs.
- Preserve useful requirements and user-authored decisions.
- Identify duplicate, stale, vague, and repository-derivable content.
- Move details to supporting docs, updating references in the root contract.
- Do not silently change product scope, technology, security posture, or release
  criteria.

If the user asks for review only, report findings and propose a patch without
editing. If the user asks to make the change, edit only instruction documents
unless they explicitly request broader work.

## Verification

After editing:

- Check the root `AGENTS.md` line count; report it and confirm it is below 200
  unless the user approved an exception.
- Verify every referenced supporting document exists.
- Check relative paths and headings for obvious mistakes.
- Run `git diff --check`.
- Inspect `git diff` and confirm only intended instruction files changed.
- Report moved information, unresolved assumptions, and unconfirmed commands.

Do not create a commit unless explicitly requested. After creating or changing a
global OpenCode skill, tell the user to restart OpenCode so it is discovered.
