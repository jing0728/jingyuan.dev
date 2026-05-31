# jingyuan.dev

An interactive pixel-art portfolio built with Astro, Phaser, Tiled, and MDX.

The homepage is a small village map. Visitors can walk around, enter buildings, use the minimap for fast travel, and open content previews for About, Work Blog, Study Notes, Projects, LeetCode, Resume, and Contact.

## Tech Stack

- Astro for the site and routing
- MDX content collections for notes, projects, experience, and LeetCode writeups
- Phaser for the interactive map
- Tiled for authoring the village map
- Vercel for deployment
- Auth.js / GitHub OAuth for private content access

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

```txt
http://localhost:4321
```

Build locally:

```bash
npm run build
```

## Content

Public content is stored under `src/content/`.

```txt
src/content/learning/      Study notes
src/content/projects/      Side projects
src/content/experience/    Work blog and resume entries
src/content/leetcode/      LeetCode solutions
```

Each entry is a `.md` or `.mdx` file with frontmatter.

### Study Notes

```mdx
---
title: "Understanding React useEffect"
date: 2026-06-01
tags: ["react", "frontend"]
summary: "Notes on when useEffect runs and how dependency arrays work."
---

## Notes

Write the note here.
```

### Projects

```mdx
---
title: "Pixel Portfolio Map"
date: 2026-06-01
repo: "https://github.com/jing0728/jingyuan.dev"
demo: "https://jingyuan.dev"
tech: ["Astro", "Phaser", "Tiled"]
summary: "A pixel-art interactive portfolio."
---

## Overview

Write the project details here.
```

### Work Blog / Experience

```mdx
---
title: "Software Engineering Intern"
company: "Example Company"
location: "New York, NY"
startDate: 2026-01-01
endDate: 2026-05-30
tech: ["TypeScript", "React"]
summary: "Built internal tools and improved frontend workflows."
---

## Work

Write the experience note here.
```

### LeetCode

```mdx
---
problemId: 1
title: "Two Sum"
date: 2026-06-01
difficulty: "Easy"
tags: ["array", "hash-map"]
---

## Idea

Write the solution explanation here.
```

Set `private: true` in frontmatter to hide an entry from public visitors.

## Map

The interactive village map is stored at:

```txt
public/assets/map/village.tmj
```

The Phaser runtime is implemented in:

```txt
src/game/farm.ts
```

The homepage shell, modals, minimap, landing screen, and content rendering live in:

```txt
src/pages/index.astro
```

Map triggers are authored in Tiled object layers. The main trigger routes are:

```txt
Project      -> /projects
Study_notes  -> /learning
resume       -> /resume
about_me     -> /about
Leetcode     -> /leetcode
Contact      -> /contact
Experience   -> /experience
```

## Assets

Only the runtime assets needed by the current map are tracked in Git. Full local art packs, source archives, Tiled session files, and editable art source files are ignored by `.gitignore`.

Pixel art assets are credited in the site footer where applicable.

## Auth Setup

Create a GitHub OAuth app:

```txt
Homepage URL:
http://localhost:4321

Authorization callback URL:
http://localhost:4321/api/auth/callback/github
```

For production, use:

```txt
https://jingyuan.dev
https://jingyuan.dev/api/auth/callback/github
```

Fill `.env` based on `.env.example`.

Only `OWNER_USERNAME` should be able to access private content.

## Deployment

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables in Vercel.
4. Add the production callback URL to the GitHub OAuth app.
5. Deploy.

## Useful Commands

```bash
npm run dev
npm run build
git status
git add .
git commit -m "Update site"
git push
```
