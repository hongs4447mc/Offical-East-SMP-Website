(() => {
	const config = window.EAST_SMP_SUPABASE_CONFIG;
	const announcementsList = document.querySelector('#announcements-list');
	const eventsList = document.querySelector('#events-list');

	if (!config?.supabaseUrl || !config?.publishableKey || !announcementsList || !eventsList) {
		return;
	}

	const loadCollection = async (table, query) => {
		const response = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, {
			headers: {apikey: config.publishableKey},
		});
		if (!response.ok) {
			throw new Error(`Could not load ${table} (${response.status}): ${await response.text()}`);
		}
		return response.json();
	};

	const emptyState = (title, body) => {
		const article = document.createElement('article');
		article.className = 'announcement-empty';
		const heading = document.createElement('h2');
		heading.textContent = title;
		const description = document.createElement('p');
		description.textContent = body;
		article.append(heading, description);
		return article;
	};

	const renderAnnouncements = (items) => {
		announcementsList.replaceChildren();
		if (items.length === 0) {
			announcementsList.append(emptyState('No announcements yet', 'Check back later for news from the East SMP team.'));
			return;
		}

		items.forEach((item) => {
			const article = document.createElement('article');
			article.className = 'announcement-card';
			const date = document.createElement('time');
			date.dateTime = item.published_at || item.created_at;
			date.textContent = formatDate(item.published_at || item.created_at);
			const heading = document.createElement('h2');
			heading.textContent = item.title;
			const body = document.createElement('p');
			body.textContent = item.body;
			article.append(date, heading, body);
			announcementsList.append(article);
		});
	};

	const renderEvents = (items) => {
		eventsList.replaceChildren();
		if (items.length === 0) {
			eventsList.append(emptyState(
				'No upcoming events',
				'Published events with a future start time or an end time that has not passed appear here.',
			));
			return;
		}

		items.forEach((item) => {
			const article = document.createElement('article');
			article.className = 'event-card';
			const date = document.createElement('time');
			date.dateTime = item.starts_at;
			date.textContent = formatDate(item.starts_at);
			const heading = document.createElement('h3');
			heading.textContent = item.title;
			const meta = document.createElement('p');
			meta.className = 'event-card-meta';
			meta.textContent = item.ends_at ? `Ends ${formatDate(item.ends_at)}` : 'East SMP event';
			const description = document.createElement('p');
			description.textContent = item.description || 'More event details coming soon.';
			article.append(date, heading, meta, description);
			eventsList.append(article);
		});
	};

	const formatDate = (value) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value || '') : date.toLocaleString();
	};

	const showError = (element, label, error) => {
		element.replaceChildren(emptyState(`${label} unavailable`, 'Please try again later.'));
		console.error(`Unable to load public ${label.toLowerCase()}.`, error);
	};

	loadCollection(
		'community_announcements',
		'select=id,title,body,published_at,created_at&published=eq.true&order=published_at.desc',
	).then(renderAnnouncements).catch((error) => {
		showError(announcementsList, 'Announcements', error);
	});

	const now = new Date().toISOString();
	const eventQuery = new URLSearchParams({
		select: 'id,title,description,starts_at,ends_at',
		published: 'eq.true',
		or: `(starts_at.gte.${now},ends_at.gte.${now})`,
		order: 'starts_at.asc',
	});
	loadCollection('community_events', eventQuery.toString()).then(renderEvents).catch((error) => {
		showError(eventsList, 'Events', error);
	});
})();
