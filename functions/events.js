(() => {
	const config = window.EAST_SMP_SUPABASE_CONFIG;
	const calendar = document.querySelector('#calendar-view');
	const heading = document.querySelector('#calendar-heading');
	const status = document.querySelector('#calendar-status');
	const previousButton = document.querySelector('#calendar-previous');
	const nextButton = document.querySelector('#calendar-next');
	const categoryFilter = document.querySelector('#event-category-filter');
	const categoryNames = {
		community: 'Community',
		pvp: 'PvP',
		building: 'Building',
		survival: 'Survival',
		special: 'Special',
		maintenance: 'Maintenance',
	};
	const eventFields = 'id,title,category,starts_at,ends_at,banner_url,host,location,participant_count,capacity,registration_open';
	let events = [];
	let activeView = 'month';
	let cursorDate = new Date();
	let activeCategory = 'all';

	const eventUrl = (eventId) => `event.html?id=${encodeURIComponent(eventId)}`;

	const setStatus = (message, kind = '') => {
		status.textContent = message;
		status.dataset.kind = kind;
	};

	const formatDate = (value, options = {}) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(undefined, options);
	};

	const eventEnd = (event) => new Date(event.ends_at || event.starts_at);
	const filteredEvents = () => events.filter((event) => activeCategory === 'all' || event.category === activeCategory);

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

	const makeEventCard = (event) => {
		const card = document.createElement('article');
		card.className = 'calendar-event-card';

		const category = document.createElement('span');
		category.className = 'event-category';
		category.textContent = categoryNames[event.category] || 'Community';

		const title = document.createElement('h3');
		const link = document.createElement('a');
		link.href = eventUrl(event.id);
		link.textContent = event.title;
		title.append(link);

		const date = document.createElement('time');
		date.dateTime = event.starts_at;
		date.textContent = formatDate(event.starts_at, {dateStyle: 'medium', timeStyle: 'short'});

		const details = document.createElement('p');
		details.className = 'calendar-event-meta';
		const parts = [];
		if (event.host) {
			parts.push(`Host: ${event.host}`);
		}
		if (event.location) {
			parts.push(`Location: ${event.location}`);
		}
		if (event.capacity) {
			parts.push(`${Number(event.participant_count) || 0} / ${event.capacity} participants`);
		} else {
			parts.push(`${Number(event.participant_count) || 0} participants`);
		}
		details.textContent = parts.join(' · ');
		card.append(category, title, date, details);

		const imageUrl = safeImageUrl(event.banner_url);
		if (imageUrl) {
			const image = document.createElement('img');
			image.className = 'calendar-event-banner';
			image.src = imageUrl;
			image.alt = '';
			image.loading = 'lazy';
			card.prepend(image);
		}
		return card;
	};

	const appendEmptyMessage = (container, message) => {
		const empty = document.createElement('p');
		empty.className = 'calendar-empty';
		empty.textContent = message;
		container.append(empty);
	};

	const renderList = (items, emptyMessage) => {
		calendar.replaceChildren();
		if (items.length === 0) {
			appendEmptyMessage(calendar, emptyMessage);
			return;
		}
		const list = document.createElement('div');
		list.className = 'calendar-event-list';
		items.forEach((event) => list.append(makeEventCard(event)));
		calendar.append(list);
	};

	const renderMonth = () => {
		const year = cursorDate.getFullYear();
		const month = cursorDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const weekCount = Math.ceil((firstDay.getDay() + daysInMonth) / 7);
		const gridStart = new Date(year, month, 1 - firstDay.getDay());
		const selected = filteredEvents();
		const grid = document.createElement('div');
		grid.className = 'month-calendar';

		for (let day = 0; day < 7; day += 1) {
			const label = document.createElement('div');
			label.className = 'calendar-weekday';
			label.textContent = new Date(2024, 0, 7 + day).toLocaleDateString(undefined, {weekday: 'short'});
			grid.append(label);
		}

		for (let index = 0; index < weekCount * 7; index += 1) {
			const date = new Date(gridStart);
			date.setDate(gridStart.getDate() + index);
			const nextDate = new Date(date);
			nextDate.setDate(date.getDate() + 1);
			const cell = document.createElement('section');
			cell.className = 'calendar-day';
			if (date.getMonth() !== month) {
				cell.classList.add('calendar-day-outside');
			}

			const dayNumber = document.createElement('h3');
			dayNumber.textContent = String(date.getDate());
			cell.append(dayNumber);

			selected
				.filter((event) => new Date(event.starts_at) < nextDate && eventEnd(event) >= date)
				.forEach((event) => {
					const link = document.createElement('a');
					link.className = 'calendar-day-event';
					link.href = eventUrl(event.id);
					link.textContent = event.title;
					link.title = `${categoryNames[event.category] || 'Community'} · ${formatDate(event.starts_at, {timeStyle: 'short'})}`;
					cell.append(link);
				});
			grid.append(cell);
		}

		heading.textContent = cursorDate.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
		calendar.replaceChildren(grid);
	};

	const startOfWeek = (date) => {
		const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
		start.setDate(start.getDate() - start.getDay());
		return start;
	};

	const renderWeek = () => {
		const start = startOfWeek(cursorDate);
		const end = new Date(start);
		end.setDate(start.getDate() + 7);
		const endLabel = new Date(end);
		endLabel.setDate(end.getDate() - 1);
		heading.textContent = `${start.toLocaleDateString(undefined, {month: 'short', day: 'numeric'})} – ${endLabel.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}`;

		const week = document.createElement('div');
		week.className = 'week-calendar';
		const selected = filteredEvents();
		for (let offset = 0; offset < 7; offset += 1) {
			const day = new Date(start);
			day.setDate(start.getDate() + offset);
			const nextDay = new Date(day);
			nextDay.setDate(day.getDate() + 1);
			const section = document.createElement('section');
			section.className = 'week-calendar-day';
			const label = document.createElement('h3');
			label.textContent = day.toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'});
			section.append(label);
			const dailyEvents = selected
				.filter((event) => new Date(event.starts_at) < nextDay && eventEnd(event) >= day)
				.sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
			if (dailyEvents.length) {
				dailyEvents.forEach((event) => section.append(makeEventCard(event)));
			} else {
				const empty = document.createElement('p');
				empty.className = 'calendar-day-empty';
				empty.textContent = 'No events scheduled.';
				section.append(empty);
			}
			week.append(section);
		}
		calendar.replaceChildren(week);
	};

	const updateNavigation = () => {
		const hasPeriod = activeView === 'month' || activeView === 'week';
		previousButton.hidden = !hasPeriod;
		nextButton.hidden = !hasPeriod;
	};

	const render = () => {
		updateNavigation();
		const selected = filteredEvents();
		if (activeView === 'month') {
			renderMonth();
		} else if (activeView === 'week') {
			renderWeek();
		} else if (activeView === 'upcoming') {
			heading.textContent = 'Upcoming events';
			const now = new Date();
			const upcoming = selected
				.filter((event) => eventEnd(event) >= now)
				.sort((left, right) => new Date(left.starts_at) - new Date(right.starts_at));
			renderList(upcoming, 'There are no upcoming events in this category.');
		} else {
			heading.textContent = 'Past events archive';
			const now = new Date();
			const past = selected
				.filter((event) => eventEnd(event) < now)
				.sort((left, right) => new Date(right.starts_at) - new Date(left.starts_at));
			renderList(past, 'There are no past events in this category yet.');
		}
	};

	const changePeriod = (amount) => {
		if (activeView === 'month') {
			cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + amount, 1);
		} else {
			cursorDate = new Date(cursorDate);
			cursorDate.setDate(cursorDate.getDate() + amount * 7);
		}
		render();
	};

	const loadEvents = async () => {
		if (!config?.supabaseUrl || !config?.publishableKey) {
			throw new Error('The public event calendar is not configured.');
		}
		const url = new URL('/rest/v1/community_events', config.supabaseUrl);
		url.search = new URLSearchParams({
			select: eventFields,
			published: 'eq.true',
			order: 'starts_at.asc',
			limit: '1000',
		});
		const response = await fetch(url, {
			headers: {
				apikey: config.publishableKey,
				Authorization: `Bearer ${config.publishableKey}`,
			},
		});
		const result = await response.json();
		if (!response.ok) {
			throw new Error(result.message || 'Published events could not be loaded.');
		}
		if (!Array.isArray(result)) {
			throw new Error('The event calendar returned an unexpected response.');
		}
		events = result;
		setStatus(`${events.length} published ${events.length === 1 ? 'event' : 'events'} loaded.`);
		render();
	};

	document.querySelector('.calendar-views').addEventListener('click', (event) => {
		const button = event.target.closest('button[data-view]');
		if (!button) {
			return;
		}
		activeView = button.dataset.view;
		document.querySelectorAll('.calendar-views [data-view]').forEach((viewButton) => {
			viewButton.setAttribute('aria-pressed', String(viewButton === button));
		});
		render();
	});

	previousButton.addEventListener('click', () => changePeriod(-1));
	nextButton.addEventListener('click', () => changePeriod(1));
	categoryFilter.addEventListener('change', () => {
		activeCategory = categoryFilter.value;
		render();
	});

	loadEvents().catch((error) => {
		setStatus(error.message || 'Events could not be loaded.', 'error');
		appendEmptyMessage(calendar, 'The calendar is unavailable right now. Please try again later.');
		console.error('Unable to load public East SMP events.', error);
	});
})();
