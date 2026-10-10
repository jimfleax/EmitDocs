---
name: enforcing-file-organization
description: Enforces strict file organization rules for scratch files, planning documents, and important documentation. Use when an agent is creating scripts, writing plans, generating docs, or any general development tasks that output files.
---

# Enforcing File Organization

## When to use this skill
- When creating throwaway, scratch, or temporary scripts and files.
- When creating planning documents before or during implementation.
- When generating or updating important project documentation.
- Whenever you are unsure where to save a newly generated file.

## Workflow
- [ ] Evaluate the type of file being created (scratch/temp, planning, or important doc).
- [ ] Choose the correct directory based on the file type.
- [ ] For planning docs, ensure the filename reflects the session and feature.
- [ ] For important docs, explicitly report the creation/update to the user.

## Instructions

### 1. Scratch Scripts and Temporary Files
- **Rule:** Store all scratch scripts, temporary files, debug logs, and throwaway code ONLY in the `scratch/` directory.
- **Restriction:** Do NOT store these files in the root directory, inside `api/`, `web/`, or any other project folders.
- **Example:** `scratch/test-db-connection.js`

### 2. Planning Documents
- **Rule:** Store all planning docs created by agents in the `scratch/plannings/` folder.
- **Naming Convention:** The filename MUST reflect the session and the feature to be implemented.
- **Example:** `scratch/plannings/session-1-auth-feature-plan.md`

### 3. Important Documentations
- **Rule:** Store all important documentation (architectural decisions, API specs, setup guides, etc.) in the `docs/` directory.
- **Naming Convention:** Use descriptive and proper names for the files.
- **Requirement:** You MUST explicitly report to the user in your response whenever you create or update an important document in the `docs/` directory.
- **Example:** `docs/database-schema.md`
