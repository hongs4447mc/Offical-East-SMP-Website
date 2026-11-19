# BlueMap setup

The website's Map page is ready, but the live map must be generated and hosted by the Minecraft server. No server credentials are needed in the website.

## Install BlueMap on the server

1. Confirm the server runs Minecraft Java Edition on Paper/Spigot, Fabric, Forge, or another BlueMap-supported platform. Install the BlueMap release that matches the server platform and Minecraft version from the [official releases](https://github.com/BlueMap-Minecraft/BlueMap/releases).
2. Upload the plugin JAR to `plugins/` (Paper/Spigot) or the mod JAR to `mods/` (Fabric/Forge), then restart the server.
3. In `plugins/BlueMap/core.conf`, review the configuration and set `accept-download: true` to allow BlueMap to download its required Mojang resources.
4. Ask the Folium host for an additional public port for BlueMap. The game server already uses port `25711`; BlueMap's webserver defaults to `8100`, but hosting providers often assign a different port.
5. In `plugins/BlueMap/webserver.conf`, set `port` to the port assigned by the host. BlueMap's default bind address serves on available interfaces. Restart or reload BlueMap and check the server console for rendering progress.
6. Open the public BlueMap address in a browser, for example `http://n-dal-1.folium.host:<assigned-port>/`. BlueMap creates maps for worlds it detects; the Nether and End appear when those worlds are present and configured.

If the website is served over HTTPS, the map URL also needs HTTPS to embed inside the page. An HTTP map URL can still be opened separately, but browsers block it inside an HTTPS page. Ask the host about HTTPS or a reverse proxy if needed.

## Connect the website

After confirming the public map URL, edit `functions/bluemap-config.js`:

```js
window.EAST_SMP_BLUEMAP_CONFIG = {
	mapUrl: 'https://your-public-bluemap-url/',
};
```

Publish the updated site. The Map page embeds the URL and also provides an open-in-new-tab link.

## Dimensions, spawn, players, and landmarks

- BlueMap map configs live in `plugins/BlueMap/maps/`. The map's `start-pos` defaults to the world spawn, so the map opens near spawn unless configured otherwise.
- Online player locations were requested to be visible. In `plugins/BlueMap/plugin.conf`, keep `live-player-markers: true`. Anyone who can open the map can then see online player positions.
- BlueMap markers are configured per map under `marker-sets`; the [official marker guide](https://bluemap.bluecolored.de/wiki/customization/Markers.html) describes point-of-interest markers for spawn, public builds, and landmarks.
- Actual landmark markers need their world/dimension and coordinates. None have been added yet because those coordinates were not provided.

See the [official BlueMap installation guide](https://bluemap.bluecolored.de/wiki/getting-started/Installation.html) and [webserver configuration](https://bluemap.bluecolored.de/wiki/configs/Webserver.html) for platform-specific details.
