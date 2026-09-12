---
"@templatical/template-tools": patch
---

Agent Skill: one skill with a thin router, replacing the two separate skills.
The entry point drops from 50 KB across two files to under 4 KB, with every
playbook loaded on demand. SDK reference documentation is now fetched from
docs.templatical.com rather than packed into the skill, so it can no longer go
stale between installs.
