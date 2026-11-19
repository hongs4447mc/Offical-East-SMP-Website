# Community dashboard setup

The staff dashboard is a static page protected by Supabase Discord sign-in and database row-level security. The Supabase publishable key is public; no secret key belongs in website files. This setup uses the Supabase browser client and does not require `@supabase/server`.

## Database

1. In the Supabase SQL Editor, run [`community-admin.sql`](./community-admin.sql). It creates the staff roles, player directory, moderation records, announcements, events, polls, profiles, and audit log with role-based access.
2. Keep the existing [`voting.sql`](./voting.sql) installed for the protagonist poll.

If you installed the community schema before the advanced event calendar was added, rerun the updated `community-admin.sql`. It adds event categories and details, staff-managed participant lists, public participant counts, and database-enforced capacity checks. Participant names are never readable to anonymous visitors.

## Discord sign-in

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. In the application's **General Information** or **OAuth2** settings, copy its **Client ID**. In **OAuth2**, create or reset the **Client Secret** and copy it.
3. In Supabase, open **Authentication → Providers → Discord**. Copy the callback URL shown there. For this project it should be `https://tqxswfhzjrwreqipjoaj.supabase.co/auth/v1/callback`.
4. Add that callback URL to the Discord application's OAuth2 redirect URLs. This is Supabase's callback, not your website URL.
5. Paste the Discord Client ID and Client Secret into Supabase's Discord provider settings, enable the provider, and save.
6. In Supabase **Authentication → URL Configuration**, add the deployed `admin.html` address to the allowed redirect URLs (for example, `https://your-site.example/src/admin.html`). When testing locally with a server on port 3000, also add `http://localhost:3000/src/admin.html` (or the matching address and port used by your local server).

If Discord sign-in returns to the site's root URL instead of `admin.html`, Supabase likely rejected the requested redirect because it is not in the allowed redirect URLs. Add the exact dashboard address there, then retry with the local website server still running.

Keep the Discord Client Secret in Supabase only. Never paste it into chat or put it in website files.
The dashboard uses the PKCE OAuth flow. Do not share the full address bar URL after sign-in; callback codes and tokens in it are credentials.

## Bootstrap the first Owner

1. Publish the site and open `src/admin.html`, or press **Ctrl+Alt+Shift+T** on a public site page.
2. Sign in with Discord. A new account will be told it has no staff role; copy the displayed Supabase user ID.
3. In the SQL Editor, grant the first Owner role (replace the placeholder with that user ID):

```sql
insert into public.staff_roles (user_id, role)
values ('00000000-0000-0000-0000-000000000000', 'owner');
```

4. Sign out and sign in again. Owners can then assign, change, or revoke staff roles from the dashboard's **Staff & roles** section.

If the database schema was installed before the role-change feature was added, rerun the updated [`community-admin.sql`](./community-admin.sql) in the SQL Editor to install its role-change function.

## Permissions and moderation scope

- Owners manage staff roles and all dashboard sections.
- Administrators manage the dashboard and audit log.
- Moderators manage player and warning/ban records.
- Event Managers manage events.
- Event Managers can add and remove event participants. Public event pages show participant counts only; registration is staff-managed and stops at capacity.
- Announcement Managers manage announcements.
- Warnings and bans created here are community records only. They do not issue commands to the Minecraft server.

Public announcements, published events, and open community polls are displayed on the website. Event times use each visitor's local timezone. Do not place a Supabase secret key, Discord client secret, or other server credential in `functions/supabase-config.js`.
