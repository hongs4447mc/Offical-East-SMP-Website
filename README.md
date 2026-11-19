# East SMP

Welcome to the official **East SMP website**!

East SMP is a Minecraft Survival Multiplayer (SMP) community built for players to explore, build, survive, and have fun together.

## About East SMP

East SMP is focused on creating an enjoyable multiplayer survival experience with a community-driven environment.

## Website

This repository contains the source code for the official East SMP website.

## Development

This website is currently under development. More features and improvements will be added over time.

## Community dashboard

The private staff dashboard is available at `src/admin.html` and can also be opened from public pages with **Ctrl+Alt+Shift+T**. Configure Discord sign-in, run the community schema, and bootstrap the first Owner using the steps in [`supabase/community-admin-setup.md`](./supabase/community-admin-setup.md).

Warnings and bans in the dashboard are community records only; they do not issue commands to the Minecraft server.

## BlueMap

The public map page is `src/map.html`. Install and configure BlueMap on the Minecraft server, then set the public URL in `functions/bluemap-config.js` using [`bluemap-setup.md`](./bluemap-setup.md).

## Events

The public calendar is available at `src/events.html`, with individual event pages at `src/event.html`. Staff manage event details and private participant rosters from the dashboard's **Events** section. Run or rerun [`supabase/community-admin.sql`](./supabase/community-admin.sql) to install the event fields, participant policies, and capacity checks.

## License

All rights reserved. Please do not copy, redistribute, or reuse this project's content without permission.

---

**© East SMP — All Rights Reserved.**