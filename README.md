# jingyuan.dev

Personal site — blog, tools, and LeetCode notes. Built with Astro + MDX, deployed on Vercel, GitHub-OAuth-gated for private content.

## Local dev

```bash
npm install
cp .env.example .env  # then fill in real values
npm run dev
```

Open http://localhost:4321.

## Writing content

Each kind of content lives under `src/content/`:

- `blog/` — long-form learning notes
- `tools/` — small work tools (each has a GitHub repo link)
- `leetcode/` — one MDX file per problem

Frontmatter field `private: true` hides a post from non-logged-in visitors. The owner sees a `private` badge in lists.

## Auth setup

1. Create a GitHub OAuth app at https://github.com/settings/developers
   - Homepage URL (local): `http://localhost:4321`
   - Authorization callback URL (local): `http://localhost:4321/api/auth/callback/github`
   - For production, repeat with `https://jingyuan.dev`
2. Fill `.env` with the client id/secret, a random `AUTH_SECRET` (`openssl rand -base64 32`), and your `OWNER_USERNAME`.

Only `OWNER_USERNAME` can sign in — the `signIn` callback in `auth.config.ts` rejects everyone else.

## Deploy

1. Push to GitHub.
2. Import the repo on https://vercel.com.
3. Set the same env vars in Vercel project settings (omit `AUTH_TRUST_HOST` — Vercel handles it).
4. Add the prod callback URL to your GitHub OAuth app.
