(() => {
	const config = window.EAST_SMP_SUPABASE_CONFIG;
	const status = document.querySelector('#event-status');
	const article = document.querySelector('#event-detail');
	const categoryNames = {
		community: 'Community',
		pvp: 'PvP',
		building: 'Building',
		survival: 'Survival',
		special: 'Special',
		maintenance: 'Maintenance',
	};
	let countdownTimer;

	const setStatus = (message, kind = '') => {
		status.textContent = message;
		status.dataset.kind = kind;
	};

	const formatDate = (value) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, {dateStyle: 'full', timeStyle: 'short'});
	};

	const safeImageUrl = (value) => {
		if (!value) {
			return null;
		}
		try {
			const url = new URL(value);
			return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
		} catch {
			return null;
		}
	};

	const addScheduleItem = (list, label, value) => {
		if (!value) {
			return;
		}
		const term = document.createElement('dt');
		term.textContent = label;
		const description = document.createElement('dd');
		description.textContent = value;
		list.append(term, description);
	};

	const formatDuration = (milliseconds) => {
		const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		const parts = [];
		if (days) {
			parts.push(`${days}d`);
		}
		if (hours || days) {
			parts.push(`${hours}h`);
		}
		if (minutes || hours || days) {
			parts.push(`${minutes}m`);
		}
		parts.push(`${seconds}s`);
		return parts.join(' ');
	};

	const updateCountdown = (event) => {
		const target = document.querySelector('#event-countdown');
		const now = Date.now();
		const start = new Date(event.starts_at).getTime();
		const end = event.ends_at ? new Date(event.ends_at).getTime() : null;
		if (now < start) {
			target.textContent = `Starts in ${formatDuration(start - now)}`;
			return true;
		}
		if (end && now < end) {
			target.textContent = `In progress · ends in ${formatDuration(end - now)}`;
			return true;
		}
		if (!end) {
			target.textContent = 'In progress';
			return false;
		}
		target.textContent = 'Event completed';
		return false;
	};

	const renderEvent = (event) => {
		document.title = `East SMP — ${event.title}`;
		document.querySelector('#event-category').textContent = categoryNames[event.category] || 'Community';
		document.querySelector('#event-title').textContent = event.title;
		const description = document.querySelector('#event-description');
		description.textContent = event.description || '';
		description.hidden = !event.description;

		const banner = document.querySelector('#event-banner');
		const bannerUrl = safeImageUrl(event.banner_url);
		if (bannerUrl) {
			banner.src = bannerUrl;
			banner.hidden = false;
		}

		const schedule = document.querySelector('#event-schedule');
		addScheduleItem(schedule, 'Starts', formatDate(event.starts_at));
		addScheduleItem(schedule, 'Ends', event.ends_at ? formatDate(event.ends_at) : '');
		addScheduleItem(schedule, 'Host', event.host);
		addScheduleItem(schedule, 'Location', event.location);
		addScheduleItem(schedule, 'Coordinates', event.coordinates);

		const capacity = event.capacity ? Number(event.capacity) : null;
		const participantCount = Number(event.participant_count) || 0;
		const registrationState = !event.registration_open
			? 'Closed'
			: capacity !== null && participantCount >= capacity
				? 'Full'
				: 'Open';
		addScheduleItem(schedule, 'Registration', `Staff-managed · ${registrationState}`);
		addScheduleItem(schedule, 'Participants', capacity
			? `${participantCount} / ${capacity}`
			: `${participantCount}`);

		[
			['rules', 'event-rules-section', 'event-rules'],
			['requirements', 'event-requirements-section', 'event-requirements'],
			['results', 'event-results-section', 'event-results'],
		].forEach(([field, sectionId, textId]) => {
			const section = document.querySelector(`#${sectionId}`);
			const text = document.querySelector(`#${textId}`);
			text.textContent = event[field] || '';
			section.hidden = !event[field];
		});

		article.hidden = false;
		setStatus('');
		updateCountdown(event);
		countdownTimer = window.setInterval(() => {
			if (!updateCountdown(event)) {
				window.clearInterval(countdownTimer);
			}
		}, 1000);
	};

	const loadEvent = async () => {
		const eventId = new URLSearchParams(window.location.search).get('id');
		if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
			setStatus('A valid event link is required.', 'error');
			return;
		}
		if (!config?.supabaseUrl || !config?.publishableKey) {
			throw new Error('Event details are not configured.');
		}

		const url = new URL('/rest/v1/community_events', config.supabaseUrl);
		url.search = new URLSearchParams({
			select: 'id,title,description,rules,category,banner_url,starts_at,ends_at,host,location,coordinates,requirements,capacity,registration_open,participant_count,results',
			id: `eq.${eventId}`,
			published: 'eq.true',
			limit: '1',
		});
		const response = await fetch(url, {
			headers: {
				apikey: config.publishableKey,
				Authorization: `Bearer ${config.publishableKey}`,
			},
		});
		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.message || 'Event details could not be loaded.');
		}
		if (!Array.isArray(result)) {
			throw new Error('Event details returned an unexpected response.');
		}
		if (result.length === 0) {
			setStatus('This event is unavailable or has not been published.', 'error');
			return;
		}
		renderEvent(result[0]);
	};

	loadEvent().catch((error) => {
		setStatus(error.message || 'Event details could not be loaded.', 'error');
		console.error('Unable to load East SMP event details.', error);
	});
})();
