const statusDropdown = document.querySelector('.server-status-dropdown');
const minecraftStatusText = document.querySelector('#minecraft-status-text');
const minecraftStatusIndicator = document.querySelector('#minecraft-status-indicator');
const minecraftPlayerCount = document.querySelector('#minecraft-player-count');
const minecraftLastChecked = document.querySelector('#minecraft-last-checked');
const discordOnlineCount = document.querySelector('#discord-online-count');
const discordTotalCount = document.querySelector('#discord-total-count');
let lastMinecraftCheck = 0;
let lastStatusRefresh = 0;
let statusCacheWarningLogged = false;

const statusCacheDuration = 30_000;

const warnStatusCacheIssue = (operation, error) => {
	if (statusCacheWarningLogged) {
		return;
	}

	statusCacheWarningLogged = true;
	console.warn(`Unable to ${operation} the short-lived server status cache; continuing without it.`, error);
};

const fetchCachedStatus = async (cacheKey, url) => {
	let serializedCache;

	try {
		serializedCache = sessionStorage.getItem(cacheKey);
	} catch (error) {
		warnStatusCacheIssue('read', error);
	}

	if (serializedCache) {
		try {
			const cachedStatus = JSON.parse(serializedCache);
			const cacheAge = Date.now() - cachedStatus.checkedAt;

			if (
				Number.isFinite(cachedStatus.checkedAt) &&
				cacheAge >= 0 &&
				cacheAge < statusCacheDuration &&
				cachedStatus.data &&
				typeof cachedStatus.data === 'object'
			) {
				return cachedStatus;
			}
		} catch (error) {
			warnStatusCacheIssue('parse', error);
		}
	}

	const response = await fetch(url, { cache: 'no-cache' });

	if (!response.ok) {
		throw new Error(`Status API returned HTTP ${response.status}.`);
	}

	const cachedStatus = {
		data: await response.json(),
		checkedAt: Date.now(),
	};

	try {
		sessionStorage.setItem(cacheKey, JSON.stringify(cachedStatus));
	} catch (error) {
		warnStatusCacheIssue('write', error);
	}

	return cachedStatus;
};

const renderMinecraftLastChecked = () => {
	if (!minecraftLastChecked || !lastMinecraftCheck) {
		return;
	}

	const elapsedSeconds = Math.floor((Date.now() - lastMinecraftCheck) / 1000);
	const elapsedMinutes = Math.floor(elapsedSeconds / 60);
	const elapsedHours = Math.floor(elapsedMinutes / 60);
	const elapsedDays = Math.floor(elapsedHours / 24);
	let label;

	if (elapsedSeconds < 60) {
		label = `${elapsedSeconds} second${elapsedSeconds === 1 ? '' : 's'} ago`;
	} else if (elapsedMinutes < 60) {
		label = `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
	} else if (elapsedHours < 24) {
		label = `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
	} else {
		label = `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
	}

	minecraftLastChecked.dateTime = new Date(lastMinecraftCheck).toISOString();
	minecraftLastChecked.textContent = label;
};

const setMinecraftLastChecked = (timestamp) => {
	lastMinecraftCheck = timestamp;
	renderMinecraftLastChecked();
};

const updateMinecraftStatus = async () => {
	if (!statusDropdown || !minecraftStatusText || !minecraftStatusIndicator || !minecraftPlayerCount) {
		return;
	}

	const address = statusDropdown.dataset.serverAddress?.trim();

	if (!address) {
		minecraftStatusText.textContent = 'Unavailable';
		minecraftPlayerCount.textContent = 'Unavailable';
		minecraftStatusIndicator.dataset.state = 'error';
		setMinecraftLastChecked(Date.now());
		console.error('The Minecraft server address is missing from the status menu.');
		return;
	}

	try {
		const { data: status, checkedAt } = await fetchCachedStatus(
			`east-smp-minecraft-status:${address}`,
			`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`,
		);

		if (typeof status.online !== 'boolean') {
			throw new Error('Minecraft status API returned an invalid status.');
		}

		minecraftStatusText.textContent = status.online ? 'Online' : 'Offline';
		minecraftStatusIndicator.dataset.state = status.online ? 'online' : 'offline';

		const onlinePlayers = Number(status.players?.online);
		const maxPlayers = Number(status.players?.max);

		if (!status.online) {
			minecraftPlayerCount.textContent = '0';
		} else if (Number.isFinite(onlinePlayers)) {
			minecraftPlayerCount.textContent = Number.isFinite(maxPlayers)
				? `${onlinePlayers} / ${maxPlayers}`
				: String(onlinePlayers);
		} else {
			minecraftPlayerCount.textContent = 'Unavailable';
		}

		setMinecraftLastChecked(checkedAt);
	} catch (error) {
		minecraftStatusText.textContent = 'Unavailable';
		minecraftPlayerCount.textContent = 'Unavailable';
		minecraftStatusIndicator.dataset.state = 'error';
		setMinecraftLastChecked(Date.now());
		console.error('Unable to load Minecraft server status.', error);
	}
};

const updateDiscordStatus = async () => {
	if (!discordOnlineCount || !discordTotalCount) {
		return;
	}

	try {
		const discordInviteUrl = document.querySelector('.top-join')?.href;

		if (!discordInviteUrl) {
			throw new Error('The Discord invite link is missing.');
		}

		const inviteCode = new URL(discordInviteUrl).pathname.split('/').filter(Boolean).pop();

		if (!inviteCode) {
			throw new Error('The Discord invite code is missing.');
		}

		const { data: invite } = await fetchCachedStatus(
			`east-smp-discord-status:${inviteCode}`,
			`https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
		);
		const onlineCount = invite.approximate_presence_count;
		const totalCount = invite.approximate_member_count;

		if (!Number.isFinite(onlineCount) || !Number.isFinite(totalCount)) {
			throw new Error('Discord did not return its member counts.');
		}

		discordOnlineCount.textContent = `~${onlineCount}`;
		discordTotalCount.textContent = `~${totalCount}`;
	} catch (error) {
		discordOnlineCount.textContent = 'Unavailable';
		discordTotalCount.textContent = 'Unavailable';
		console.error('Unable to load Discord member counts.', error);
	}
};

let refreshingStatuses = false;

const refreshStatuses = async () => {
	if (refreshingStatuses || Date.now() - lastStatusRefresh < 60_000) {
		return;
	}

	refreshingStatuses = true;
	lastStatusRefresh = Date.now();

	try {
		await Promise.all([updateMinecraftStatus(), updateDiscordStatus()]);
	} finally {
		refreshingStatuses = false;
	}
};

if (statusDropdown) {
	refreshStatuses();
	window.setInterval(() => {
		if (!document.hidden) {
			refreshStatuses();
		}
	}, 60_000);
	window.setInterval(() => {
		if (!document.hidden) {
			renderMinecraftLastChecked();
		}
	}, 10_000);
	document.addEventListener('visibilitychange', () => {
		if (!document.hidden) {
			refreshStatuses();
			renderMinecraftLastChecked();
		}
	});
}