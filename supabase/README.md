# Shared protagonist voting setup

The voting page is hosted as static files, so it needs an online database for a shared tally. Supabase provides the database and RPC functions used by the page. The page uses the project's public publishable key with the REST API; it does not need `@supabase/server`, a secret key, or a JWKS URL.

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`voting.sql`](./voting.sql).
3. The project URL and publishable key supplied for this project are configured in [`supabase-config.js`](../functions/supabase-config.js). If you rotate the publishable key, update it there.
4. Publish the site. Once the SQL is installed, totals are fetched from Supabase and votes are shared across visitors.

Only the public anon/publishable key belongs in the website. Never put a `service_role` or other secret key in client-side files. The SQL grants clients access only to the two vote functions; they cannot directly read or write the votes table.

Each browser stores a random voter ID so a visitor can change their vote without adding another ballot. Clearing browser storage allows a new ID, so this is suitable for a casual poll rather than a tamper-proof election.

For staff sign-in, the private dashboard, community announcements, events, profiles, and managed polls, also follow [`community-admin-setup.md`](./community-admin-setup.md) and run [`community-admin.sql`](./community-admin.sql).
