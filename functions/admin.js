(() => {
	const config = window.EAST_SMP_SUPABASE_CONFIG;
	const statusElement = document.querySelector('#admin-status');
	const signedOutPanel = document.querySelector('#admin-signed-out');
	const deniedPanel = document.querySelector('#admin-access-denied');
	const dashboard = document.querySelector('#admin-dashboard');
	const signInButton = document.querySelector('#admin-sign-in');
	const signOutButton = document.querySelector('#admin-sign-out');
	const roleLabel = document.querySelector('#admin-role-label');
	const roleNames = {
		owner: 'Owner',
		administrator: 'Administrator',
		moderator: 'Moderator',
		event_manager: 'Event Manager',
		announcement_manager: 'Announcement Manager',
	};
	const eventCategoryNames = {
		community: 'Community',
		pvp: 'PvP',
		building: 'Building',
		survival: 'Survival',
		special: 'Special',
		maintenance: 'Maintenance',
	};
	const sectionRoles = {
		overview: ['owner', 'administrator', 'moderator', 'event_manager', 'announcement_manager'],
		players: ['owner', 'administrator', 'moderator'],
		moderation: ['owner', 'administrator', 'moderator'],
		announcements: ['owner', 'administrator', 'announcement_manager'],
		events: ['owner', 'administrator', 'event_manager'],
		polls: ['owner', 'administrator'],
		profiles: ['owner', 'administrator'],
		staff: ['owner'],
		audit: ['owner', 'administrator'],
	};
	const sectionLabels = {
		players: ['Name', 'UUID', 'Notes', 'Added'],
		moderation: ['Player', 'Action', 'Reason', 'Status', 'Expires', 'Created'],
		announcements: ['Title', 'Status', 'Updated'],
		events: ['Event', 'Category', 'Starts', 'Players', 'Status'],
		'event-participants': ['Minecraft name', 'Added'],
		polls: ['Question', 'Options', 'Status', 'Created'],
		profiles: ['Player', 'Display name', 'Visibility', 'Bio'],
		staff: ['User ID', 'Role', 'Assigned'],
		audit: ['Time', 'Staff ID', 'Change', 'Record', 'Details'],
	};
	const rowsBySection = {};
	let supabase;
	let currentUser;
	let currentRoles = [];
	let currentParticipantEventId = null;

	const setStatus = (message, kind = '') => {
		statusElement.textContent = message;
		statusElement.dataset.kind = kind;
	};

	const hasAnyRole = (roles = []) => roles.some((role) => currentRoles.includes(role));

	const showSection = (sectionName) => {
		if (!sectionRoles[sectionName] || !hasAnyRole(sectionRoles[sectionName])) {
			return;
		}

		document.querySelectorAll('.admin-panel[data-section]').forEach((section) => {
			section.hidden = section.dataset.section !== sectionName;
		});
		document.querySelectorAll('#admin-tabs [data-panel]').forEach((button) => {
			if (button.dataset.panel === sectionName) {
				button.setAttribute('aria-current', 'page');
			} else {
				button.removeAttribute('aria-current');
			}
		});
		void loadSection(sectionName);
	};

	const renderTable = (containerId, sectionName, rows, columns, actions = []) => {
		const container = document.querySelector(`#${containerId}`);
		container.replaceChildren();

		if (rows.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'admin-empty';
			empty.textContent = 'Nothing here yet.';
			container.append(empty);
			return;
		}

		const table = document.createElement('table');
		table.className = 'admin-table';
		const head = document.createElement('thead');
		const headRow = document.createElement('tr');

		columns.forEach((column) => {
			const cell = document.createElement('th');
			cell.scope = 'col';
			cell.textContent = column;
			headRow.append(cell);
		});

		if (actions.length > 0) {
			const actionHeading = document.createElement('th');
			actionHeading.scope = 'col';
			actionHeading.textContent = 'Actions';
			headRow.append(actionHeading);
		}

		head.append(headRow);
		table.append(head);
		const body = document.createElement('tbody');

		rows.forEach((row) => {
			const tableRow = document.createElement('tr');

			columns.forEach((column, index) => {
				const cell = document.createElement('td');
				const value = row._display[index];
				cell.textContent = value === null || value === undefined || value === '' ? '—' : String(value);
				tableRow.append(cell);
			});

			if (actions.length > 0) {
				const cell = document.createElement('td');
				const actionList = document.createElement('div');
				actionList.className = 'admin-table-actions';

				actions.forEach((action) => {
					if (action.when && !action.when(row)) {
						return;
					}

					const button = document.createElement('button');
					button.type = 'button';
					button.className = 'admin-row-action';
					button.dataset.action = action.name;
					button.dataset.section = sectionName;
					button.dataset.id = row.id || '';
					button.dataset.userId = row.user_id || '';
					button.dataset.role = row.role || '';
					button.textContent = action.label;
					actionList.append(button);
				});

				cell.append(actionList);
				tableRow.append(cell);
			}

			body.append(tableRow);
		});

		table.append(body);
		container.append(table);
	};

	const setFormValues = (form, record) => {
		Object.entries(record).forEach(([name, value]) => {
			const field = form.elements.namedItem(name);

			if (!field) {
				return;
			}
			if (field.type === 'checkbox') {
				field.checked = Boolean(value);
				return;
			}
			if (field.type === 'datetime-local' && value) {
				const date = new Date(value);
				field.value = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
				return;
			}

			field.value = value ?? '';
		});
	};

	const formRecord = (form) => {
		const record = {};

		for (const [name, value] of new FormData(form)) {
			record[name] = value;
		}
		form.querySelectorAll('input[type="checkbox"]').forEach((field) => {
			record[field.name] = field.checked;
		});

		return record;
	};

	const resetStaffForm = () => {
		const form = document.querySelector('#staff-form');
		delete form.dataset.changeFromRole;
		form.elements.namedItem('user_id').readOnly = false;
		form.querySelector('button[type="submit"]').textContent = 'Assign role';
		document.querySelector('#staff-form-mode').hidden = true;
		document.querySelector('#staff-form-cancel').hidden = true;
	};

	const runForm = (formId, handler, refreshSection) => {
		const form = document.querySelector(`#${formId}`);
		form.addEventListener('submit', async (event) => {
			event.preventDefault();
			setStatus('Saving changes...');

			try {
				await handler(formRecord(form));
				form.reset();
				if (formId === 'staff-form') {
					resetStaffForm();
				}
				const idField = form.elements.namedItem('id');
				if (idField) {
					idField.value = '';
				}
				setStatus('Changes saved.', 'success');
				if (typeof refreshSection === 'function') {
					await refreshSection();
				} else {
					await loadSection(refreshSection);
				}
			} catch (error) {
				setStatus(error.message || 'Could not save changes.', 'error');
				console.error(`Unable to save ${formId}.`, error);
			}
		});
	};

	const requireResult = (result) => {
		if (result.error) {
			throw new Error(result.error.message);
		}
		return result.data;
	};

	const saveRecord = async (table, record, userId) => {
		const id = record.id;
		delete record.id;
		if (id) {
			record.updated_at = new Date().toISOString();
			return requireResult(await supabase.from(table).update(record).eq('id', id));
		}

		record.created_by = userId;
		return requireResult(await supabase.from(table).insert(record));
	};

	const loadPlayers = async () => {
		const players = requireResult(await supabase
			.from('community_players')
			.select('id,minecraft_name,minecraft_uuid,notes,created_at')
			.order('minecraft_name'));
		rowsBySection.players = players;
		const selects = [
			document.querySelector('#moderation-form select[name="player_id"]'),
			document.querySelector('#profile-form select[name="player_id"]'),
		];

		selects.forEach((select) => {
			const currentValue = select.value;
			select.replaceChildren();
			const placeholder = document.createElement('option');
			placeholder.value = '';
			placeholder.textContent = players.length ? 'Select a player' : 'Add a player first';
			select.append(placeholder);

			players.forEach((player) => {
				const option = document.createElement('option');
				option.value = player.id;
				option.textContent = player.minecraft_name;
				select.append(option);
			});
			select.value = currentValue;
		});

		renderTable('players-table', 'players', players.map((player) => ({
			...player,
			_display: [player.minecraft_name, player.minecraft_uuid, player.notes, formatDate(player.created_at)],
		})), sectionLabels.players, [
			{name: 'edit', label: 'Edit'},
			{name: 'delete', label: 'Delete'},
		]);
	};

	const loadModeration = async () => {
		await loadPlayers();
		const cases = requireResult(await supabase
			.from('moderation_cases')
			.select('id,player_id,action,reason,status,expires_at,created_at')
			.order('created_at', {ascending: false}));
		const playerNames = new Map((rowsBySection.players || []).map((player) => [player.id, player.minecraft_name]));
		rowsBySection.moderation = cases;
		renderTable('moderation-table', 'moderation', cases.map((item) => ({
			...item,
			_display: [
				playerNames.get(item.player_id) || 'Unknown player',
				item.action,
				item.reason,
				item.status,
				item.expires_at ? formatDate(item.expires_at) : 'Permanent',
				formatDate(item.created_at),
			],
		})), sectionLabels.moderation, [
			{name: 'revoke', label: 'Revoke', when: (item) => item.status === 'active'},
			{name: 'delete', label: 'Delete'},
		]);
	};

	const loadAnnouncements = async () => {
		const rows = requireResult(await supabase
			.from('community_announcements')
			.select('id,title,body,published,updated_at,published_at')
			.order('updated_at', {ascending: false}));
		rowsBySection.announcements = rows;
		renderTable('announcements-table', 'announcements', rows.map((item) => ({
			...item,
			_display: [item.title, item.published ? 'Published' : 'Draft', formatDate(item.updated_at)],
		})), sectionLabels.announcements, [
			{name: 'edit', label: 'Edit'},
			{name: 'toggle', label: 'Publish', when: (item) => !item.published},
			{name: 'toggle', label: 'Unpublish', when: (item) => item.published},
			{name: 'delete', label: 'Delete'},
		]);
	};

	const loadEvents = async () => {
		const rows = requireResult(await supabase
			.from('community_events')
			.select('id,title,description,rules,category,banner_url,starts_at,ends_at,host,location,coordinates,requirements,capacity,registration_open,participant_count,results,published,updated_at')
			.order('starts_at', {ascending: true}));
		rowsBySection.events = rows;
		renderTable('events-table', 'events', rows.map((item) => ({
			...item,
			_display: [
				item.title,
				eventCategoryNames[item.category] || item.category,
				formatDate(item.starts_at),
				item.capacity ? `${item.participant_count} / ${item.capacity}` : `${item.participant_count} / No limit`,
				item.published ? 'Published' : 'Draft',
			],
		})), sectionLabels.events, [
			{name: 'participants', label: 'Participants'},
			{name: 'edit', label: 'Edit'},
			{name: 'toggle', label: 'Publish', when: (item) => !item.published},
			{name: 'toggle', label: 'Unpublish', when: (item) => item.published},
			{name: 'delete', label: 'Delete'},
		]);
		if (currentParticipantEventId) {
			if (rows.some((item) => item.id === currentParticipantEventId)) {
				await loadEventParticipants(currentParticipantEventId);
			} else {
				currentParticipantEventId = null;
				document.querySelector('#event-participant-manager').hidden = true;
			}
		}
	};

	const loadEventParticipants = async (eventId) => {
		const participants = requireResult(await supabase
			.from('community_event_participants')
			.select('id,event_id,minecraft_name,added_at')
			.eq('event_id', eventId)
			.order('added_at', {ascending: true}));
		const event = (rowsBySection.events || []).find((item) => item.id === eventId);
		const isFull = event?.capacity !== null && event?.capacity !== undefined
			&& event.participant_count >= event.capacity;
		const isClosed = !event?.registration_open;
		const submitButton = document.querySelector('#event-participant-form button[type="submit"]');
		const capacityStatus = document.querySelector('#event-participant-capacity-status');
		submitButton.disabled = isFull || isClosed;
		capacityStatus.textContent = isFull
			? 'This event is full. Remove a participant or increase the capacity before adding anyone.'
			: isClosed
				? 'Staff registration is closed for this event.'
				: 'Staff registration is open.';
		rowsBySection['event-participants'] = participants;
		renderTable('event-participants-table', 'event-participants', participants.map((participant) => ({
			...participant,
			_display: [participant.minecraft_name, formatDate(participant.added_at)],
		})), sectionLabels['event-participants'], [
			{name: 'delete', label: 'Remove'},
		]);
	};

	const loadPolls = async () => {
		const rows = requireResult(await supabase
			.from('community_polls')
			.select('id,title,description,is_open,created_at,community_poll_options(id,label,sort_order)')
			.order('created_at', {ascending: false}));
		rowsBySection.polls = rows;
		renderTable('polls-table', 'polls', rows.map((item) => ({
			...item,
			_display: [
				item.title,
				(item.community_poll_options || []).map((option) => option.label).join(', '),
				item.is_open ? 'Open' : 'Closed',
				formatDate(item.created_at),
			],
		})), sectionLabels.polls, [
			{name: 'toggle', label: 'Close', when: (item) => item.is_open},
			{name: 'toggle', label: 'Reopen', when: (item) => !item.is_open},
			{name: 'delete', label: 'Delete'},
		]);
	};

	const loadProfiles = async () => {
		await loadPlayers();
		const profiles = requireResult(await supabase
			.from('community_profiles')
			.select('id,player_id,display_name,bio,avatar_url,is_public,community_players(minecraft_name)')
			.order('display_name'));
		rowsBySection.profiles = profiles;
		renderTable('profiles-table', 'profiles', profiles.map((profile) => ({
			...profile,
			_display: [
				profile.community_players?.minecraft_name || 'Unknown player',
				profile.display_name,
				profile.is_public ? 'Public' : 'Private',
				profile.bio,
			],
		})), sectionLabels.profiles, [
			{name: 'edit', label: 'Edit'},
			{name: 'delete', label: 'Delete'},
		]);
	};

	const loadStaff = async () => {
		const roles = requireResult(await supabase
			.from('staff_roles')
			.select('user_id,role,assigned_at')
			.order('assigned_at', {ascending: false}));
		rowsBySection.staff = roles;
		renderTable('staff-table', 'staff', roles.map((item) => ({
			...item,
			_display: [item.user_id, roleNames[item.role] || item.role, formatDate(item.assigned_at)],
		})), sectionLabels.staff, [
			{name: 'change-role', label: 'Change role'},
			{name: 'revoke', label: 'Revoke'},
		]);
	};

	const loadAudit = async () => {
		const logs = requireResult(await supabase
			.from('admin_audit_logs')
			.select('id,actor_id,table_name,operation,record_key,old_data,new_data,occurred_at')
			.order('occurred_at', {ascending: false})
			.limit(100));
		renderTable('audit-table', 'audit', logs.map((log) => ({
			...log,
			_display: [
				formatDate(log.occurred_at),
				log.actor_id,
				`${log.operation} ${log.table_name}`,
				log.record_key,
				JSON.stringify({old: log.old_data, new: log.new_data}),
			],
		})), sectionLabels.audit);
	};

	const countRows = async (table) => {
		const result = await supabase.from(table).select('id', {count: 'exact', head: true});
		if (result.error) {
			throw new Error(result.error.message);
		}
		return result.count ?? 0;
	};

	const loadOverview = async () => {
		const stats = [];
		const jobs = [];
		const addStat = (label, table) => {
			jobs.push(countRows(table).then((count) => stats.push({label, count})));
		};

		if (hasAnyRole(sectionRoles.players)) {
			addStat('Players', 'community_players');
			addStat('Moderation records', 'moderation_cases');
		}
		if (hasAnyRole(sectionRoles.announcements)) {
			addStat('Announcements', 'community_announcements');
		}
		if (hasAnyRole(sectionRoles.events)) {
			addStat('Events', 'community_events');
		}
		if (hasAnyRole(sectionRoles.polls)) {
			addStat('Polls', 'community_polls');
		}

		await Promise.all(jobs);
		const container = document.querySelector('#admin-stats');
		container.replaceChildren();
		stats.forEach(({label, count}) => {
			const card = document.createElement('article');
			card.className = 'admin-stat';
			const heading = document.createElement('span');
			heading.textContent = label;
			const value = document.createElement('strong');
			value.textContent = String(count);
			card.append(heading, value);
			container.append(card);
		});
	};

	const loadSection = async (sectionName) => {
		try {
			setStatus(`Loading ${sectionName}...`);
			switch (sectionName) {
				case 'overview': await loadOverview(); break;
				case 'players': await loadPlayers(); break;
				case 'moderation': await loadModeration(); break;
				case 'announcements': await loadAnnouncements(); break;
				case 'events': await loadEvents(); break;
				case 'polls': await loadPolls(); break;
				case 'profiles': await loadProfiles(); break;
				case 'staff': await loadStaff(); break;
				case 'audit': await loadAudit(); break;
				default: return;
			}
			setStatus('Dashboard ready.');
		} catch (error) {
			setStatus(error.message || 'Could not load this section.', 'error');
			console.error(`Unable to load admin section ${sectionName}.`, error);
		}
	};

	const formatDate = (value) => {
		if (!value) {
			return '—';
		}
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
	};

	const dateInputToIso = (value) => value ? new Date(value).toISOString() : null;

	const runAction = async (button) => {
		const section = button.dataset.section;
		const action = button.dataset.action;
		const id = button.dataset.id;
		const record = (rowsBySection[section] || []).find((row) => section === 'staff'
			? row.user_id === button.dataset.userId && row.role === button.dataset.role
			: row.id === id);

		if (!record) {
			throw new Error('That record is no longer available. Reload the section and try again.');
		}

		if (action === 'participants' && section === 'events') {
			currentParticipantEventId = record.id;
			document.querySelector('#event-participant-title').textContent = `Participants — ${record.title}`;
			document.querySelector('#event-participant-form [name="event_id"]').value = record.id;
			document.querySelector('#event-participant-manager').hidden = false;
			await loadEventParticipants(record.id);
			document.querySelector('#event-participant-manager').scrollIntoView({behavior: 'smooth', block: 'center'});
			return;
		}

		if (action === 'change-role' && section === 'staff') {
			const form = document.querySelector('#staff-form');
			form.elements.namedItem('user_id').value = record.user_id;
			form.elements.namedItem('user_id').readOnly = true;
			form.elements.namedItem('role').value = record.role;
			form.dataset.changeFromRole = record.role;
			const mode = document.querySelector('#staff-form-mode');
			mode.textContent = `Changing ${roleNames[record.role] || record.role} for ${record.user_id}. Choose a replacement role.`;
			mode.hidden = false;
			document.querySelector('#staff-form-cancel').hidden = false;
			form.querySelector('button[type="submit"]').textContent = 'Save role change';
			form.scrollIntoView({behavior: 'smooth', block: 'center'});
			return;
		}

		if (action === 'edit') {
			const formId = {
				players: 'player-form',
				announcements: 'announcement-form',
				events: 'event-form',
				profiles: 'profile-form',
			}[section];
			if (!formId) {
				return;
			}
			const values = {...record};
			if (section === 'profiles') {
				values.minecraft_name = record.community_players?.minecraft_name || '';
			}
			setFormValues(document.querySelector(`#${formId}`), values);
			document.querySelector(`#${formId}`).scrollIntoView({behavior: 'smooth', block: 'center'});
			return;
		}

		if (action === 'toggle') {
			const update = section === 'announcements'
				? {published: !record.published, published_at: record.published ? null : new Date().toISOString()}
				: section === 'events'
					? {published: !record.published}
					: {is_open: !record.is_open};
			const table = {
				announcements: 'community_announcements',
				events: 'community_events',
				polls: 'community_polls',
			}[section];
			requireResult(await supabase.from(table).update({...update, updated_at: new Date().toISOString()}).eq('id', id));
		} else if (action === 'revoke' && section === 'moderation') {
			requireResult(await supabase.from('moderation_cases').update({status: 'revoked'}).eq('id', id));
		} else if (action === 'revoke' && section === 'staff') {
			await confirmAction(`Revoke the ${roleNames[record.role]} role from this user?`);
			requireResult(await supabase.rpc('revoke_staff_role', {p_user_id: record.user_id, p_role: record.role}));
		} else if (action === 'delete') {
			await confirmAction('Delete this record? This cannot be undone.');
			const table = {
				players: 'community_players',
				moderation: 'moderation_cases',
				announcements: 'community_announcements',
				events: 'community_events',
				'event-participants': 'community_event_participants',
				polls: 'community_polls',
				profiles: 'community_profiles',
			}[section];
			if (!table) {
				return;
			}
			requireResult(await supabase.from(table).delete().eq('id', id));
			if (section === 'events' && currentParticipantEventId === id) {
				currentParticipantEventId = null;
				document.querySelector('#event-participant-manager').hidden = true;
			}
		}

		setStatus('Changes saved.', 'success');
		if (section === 'event-participants') {
			await loadSection('events');
		} else {
			await loadSection(section);
		}
	};

	const confirmAction = async (message) => {
		if (!window.confirm(message)) {
			throw new Error('Action cancelled.');
		}
	};

	const bindForms = () => {
		runForm('player-form', async (record) => {
			const payload = {
				...record,
				minecraft_name: record.minecraft_name.trim(),
				minecraft_uuid: record.minecraft_uuid.trim() || null,
				notes: record.notes.trim(),
			};
			await saveRecord('community_players', payload, currentUser.id);
		}, 'players');

		runForm('moderation-form', async (record) => {
			if (!record.player_id) {
				throw new Error('Add a player before creating a moderation record.');
			}
			requireResult(await supabase.from('moderation_cases').insert({
				player_id: record.player_id,
				action: record.action,
				reason: record.reason.trim(),
				expires_at: dateInputToIso(record.expires_at),
				created_by: currentUser.id,
			}));
		}, 'moderation');

		runForm('announcement-form', async (record) => {
			const published = Boolean(record.published);
			await saveRecord('community_announcements', {
				...record,
				title: record.title.trim(),
				body: record.body.trim(),
				published,
				published_at: published ? new Date().toISOString() : null,
			}, currentUser.id);
		}, 'announcements');

		runForm('event-form', async (record) => {
			const startsAt = dateInputToIso(record.starts_at);
			const endsAt = dateInputToIso(record.ends_at);
			if (endsAt && new Date(endsAt) < new Date(startsAt)) {
				throw new Error('The event end must be after its start.');
			}
			const capacity = record.capacity.trim() ? Number(record.capacity) : null;
			if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
				throw new Error('Capacity must be a whole number greater than zero.');
			}
			const bannerUrl = record.banner_url.trim();
			if (bannerUrl && !['http:', 'https:'].includes(new URL(bannerUrl).protocol)) {
				throw new Error('The event banner URL must use HTTP or HTTPS.');
			}
			await saveRecord('community_events', {
				...record,
				title: record.title.trim(),
				description: record.description.trim(),
				rules: record.rules.trim(),
				category: record.category,
				banner_url: bannerUrl || null,
				starts_at: startsAt,
				ends_at: endsAt,
				host: record.host.trim(),
				location: record.location.trim(),
				coordinates: record.coordinates.trim(),
				requirements: record.requirements.trim(),
				capacity,
				registration_open: Boolean(record.registration_open),
				results: record.results.trim(),
				published: Boolean(record.published),
			}, currentUser.id);
		}, 'events');

		runForm('event-participant-form', async (record) => {
			if (!currentParticipantEventId || record.event_id !== currentParticipantEventId) {
				throw new Error('Choose an event before adding a participant.');
			}
			requireResult(await supabase.rpc('add_community_event_participant', {
				p_event_id: currentParticipantEventId,
				p_minecraft_name: record.minecraft_name.trim(),
			}));
		}, async () => {
			await loadSection('events');
			document.querySelector('#event-participant-form [name="event_id"]').value = currentParticipantEventId;
		});

		runForm('poll-form', async (record) => {
			const options = [...new Set(record.options.split(/\r?\n/).map((value) => value.trim()).filter(Boolean))];
			if (options.length < 2) {
				throw new Error('Add at least two different poll options.');
			}
			const insertedPoll = requireResult(await supabase
				.from('community_polls')
				.insert({
					title: record.title.trim(),
					description: record.description.trim(),
					is_open: false,
					created_by: currentUser.id,
				})
				.select('id')
				.single());
			const optionResult = await supabase.from('community_poll_options').insert(options.map((label, index) => ({
				poll_id: insertedPoll.id,
				label,
				sort_order: index,
			})));
			if (optionResult.error) {
				const cleanupResult = await supabase.from('community_polls').delete().eq('id', insertedPoll.id);
				if (cleanupResult.error) {
					throw new Error(`Poll was created but its options failed: ${optionResult.error.message}. Cleanup also failed: ${cleanupResult.error.message}`);
				}
				throw new Error(`Poll options could not be saved: ${optionResult.error.message}`);
			}
			if (record.is_open) {
				requireResult(await supabase.from('community_polls').update({is_open: true}).eq('id', insertedPoll.id));
			}
		}, 'polls');

		runForm('profile-form', async (record) => {
			if (!record.player_id) {
				throw new Error('Add a player before creating a profile.');
			}
			requireResult(await supabase.from('community_profiles').upsert({
				player_id: record.player_id,
				display_name: record.display_name.trim(),
				bio: record.bio.trim(),
				avatar_url: record.avatar_url.trim() || null,
				is_public: Boolean(record.is_public),
				updated_by: currentUser.id,
				updated_at: new Date().toISOString(),
			}, {onConflict: 'player_id'}));
		}, 'profiles');

		runForm('staff-form', async (record) => {
			const form = document.querySelector('#staff-form');
			const oldRole = form.dataset.changeFromRole;
			const userId = record.user_id.trim();
			if (oldRole) {
				if (oldRole === record.role) {
					throw new Error('Choose a different role to make this change.');
				}
				requireResult(await supabase.rpc('change_staff_role', {
					p_user_id: userId,
					p_old_role: oldRole,
					p_new_role: record.role,
				}));
				return;
			}
			requireResult(await supabase.rpc('assign_staff_role', {
				p_user_id: userId,
				p_role: record.role,
			}));
		}, 'staff');
		document.querySelector('#staff-form-cancel').addEventListener('click', () => {
			const form = document.querySelector('#staff-form');
			form.reset();
			resetStaffForm();
		});
	};

	const populateDashboard = async () => {
		const buttons = [...document.querySelectorAll('#admin-tabs [data-panel]')];
		buttons.forEach((button) => {
			button.hidden = !hasAnyRole(sectionRoles[button.dataset.panel]);
		});
		roleLabel.textContent = currentRoles.map((role) => roleNames[role] || role).join(' · ');
		dashboard.hidden = false;
		signedOutPanel.hidden = true;
		deniedPanel.hidden = true;
		signOutButton.hidden = false;
		showSection('overview');
	};

	const syncSession = async (session) => {
		currentUser = session?.user || null;
		currentRoles = [];
		dashboard.hidden = true;
		signOutButton.hidden = !currentUser;
		signedOutPanel.hidden = Boolean(currentUser);
		deniedPanel.hidden = true;

		if (!currentUser) {
			setStatus('Sign in with an approved staff account.');
			return;
		}

		setStatus('Checking staff permissions...');
		try {
			const roleResult = requireResult(await supabase
				.from('staff_roles')
				.select('role')
				.eq('user_id', currentUser.id));
			currentRoles = roleResult.map((item) => item.role);
			if (currentRoles.length === 0) {
				document.querySelector('#admin-access-message').textContent = 'Your account has no staff role yet. Copy this user ID and give it to an Owner:';
				document.querySelector('#admin-user-id').textContent = currentUser.id;
				deniedPanel.hidden = false;
				setStatus('This account is signed in but has no staff role.', 'error');
				return;
			}
			await populateDashboard();
		} catch (error) {
			document.querySelector('#admin-access-message').textContent = 'Could not verify staff access. Confirm the community database setup is applied, then try again. Your user ID:';
			document.querySelector('#admin-user-id').textContent = currentUser.id;
			deniedPanel.hidden = false;
			setStatus(error.message || 'Could not verify staff access.', 'error');
			console.error('Unable to verify East SMP staff permissions.', error);
		}
	};

	const initialize = async () => {
		if (!config?.supabaseUrl || !config?.publishableKey) {
			setStatus('Supabase is not configured for this site.', 'error');
			return;
		}
		if (!window.supabase?.createClient) {
			setStatus('The Supabase client could not load. Check the network and refresh.', 'error');
			return;
		}

		supabase = window.supabase.createClient(config.supabaseUrl, config.publishableKey, {
			auth: {flowType: 'pkce'},
		});
		bindForms();
		document.querySelector('#admin-tabs').addEventListener('click', (event) => {
			const button = event.target.closest('[data-panel]');
			if (button) {
				showSection(button.dataset.panel);
			}
		});
		document.querySelector('.admin-workspace').addEventListener('click', async (event) => {
			const button = event.target.closest('button[data-action]');
			if (!button) {
				return;
			}
			try {
				await runAction(button);
			} catch (error) {
				if (error.message !== 'Action cancelled.') {
					setStatus(error.message || 'Could not complete the action.', 'error');
					console.error('Unable to complete admin action.', error);
				}
			}
		});

		signInButton.addEventListener('click', async () => {
			setStatus('Opening Discord sign-in...');
			const {error} = await supabase.auth.signInWithOAuth({
				provider: 'discord',
				options: {redirectTo: window.location.href.split(/[?#]/)[0]},
			});
			if (error) {
				setStatus(error.message, 'error');
			}
		});
		signOutButton.addEventListener('click', async () => {
			const {error} = await supabase.auth.signOut();
			if (error) {
				setStatus(error.message, 'error');
			}
		});

		supabase.auth.onAuthStateChange((_event, session) => {
			window.setTimeout(() => {
				void syncSession(session);
			}, 0);
		});

		const {data, error} = await supabase.auth.getSession();
		if (error) {
			setStatus(error.message, 'error');
			return;
		}
		await syncSession(data.session);
	};

	initialize().catch((error) => {
		setStatus(error.message || 'Dashboard failed to start.', 'error');
		console.error('Unable to initialize the East SMP dashboard.', error);
	});
})();
