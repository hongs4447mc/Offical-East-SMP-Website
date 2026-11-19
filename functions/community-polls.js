(() => {
	const container = document.querySelector('#community-polls');
	const config = window.EAST_SMP_SUPABASE_CONFIG;

	if (!container || !config?.supabaseUrl || !config?.publishableKey) {
		return;
	}

	const voterIdKey = 'east-smp-community-poll-voter-id';
	let voterId;

	const request = async (functionName, payload = {}) => {
		const response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${functionName}`, {
			method: 'POST',
			headers: {
				apikey: config.publishableKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		});
		if (!response.ok) {
			throw new Error(`Poll service returned HTTP ${response.status}: ${await response.text()}`);
		}
		return response.json();
	};

	const getVoterId = () => {
		const existing = window.localStorage.getItem(voterIdKey);
		if (existing && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(existing)) {
			return existing;
		}
		if (!window.crypto?.randomUUID) {
			throw new Error('This browser cannot create a voting ID.');
		}
		const id = window.crypto.randomUUID();
		window.localStorage.setItem(voterIdKey, id);
		return id;
	};

	const renderPolls = (polls) => {
		container.replaceChildren();
		if (polls.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'community-polls-status';
			empty.textContent = 'There are no community polls open right now.';
			container.append(empty);
			return;
		}

		polls.forEach((poll) => {
			const card = document.createElement('article');
			card.className = 'community-poll-card';
			const heading = document.createElement('h3');
			heading.textContent = poll.title;
			const description = document.createElement('p');
			description.className = 'community-poll-description';
			description.textContent = poll.description || 'Choose an option and save your vote.';
			const total = poll.options.reduce((sum, option) => sum + Number(option.votes), 0);
			const totalLabel = document.createElement('p');
			totalLabel.className = 'community-poll-total';
			totalLabel.textContent = `${total} ${total === 1 ? 'vote' : 'votes'} total`;
			const form = document.createElement('form');
			form.className = 'community-poll-options';
			const savedChoice = window.localStorage.getItem(`east-smp-community-poll-${poll.id}`);

			poll.options.forEach((option) => {
				const label = document.createElement('label');
				label.className = 'community-poll-option';
				const input = document.createElement('input');
				input.type = 'radio';
				input.name = `community-poll-${poll.id}`;
				input.value = option.id;
				input.required = true;
				input.disabled = !voterId;
				input.checked = option.id === savedChoice;
				const text = document.createElement('span');
				text.className = 'community-poll-option-label';
				text.textContent = option.label;
				const count = document.createElement('span');
				count.className = 'community-poll-option-count';
				count.textContent = `${option.votes} ${Number(option.votes) === 1 ? 'vote' : 'votes'}`;
				label.append(input, text, count);
				form.append(label);
			});

			const submit = document.createElement('button');
			submit.className = 'vote-submit';
			submit.type = 'submit';
			submit.disabled = !voterId;
			submit.textContent = 'Save vote';
			const status = document.createElement('p');
			status.className = 'vote-status community-poll-vote-status';
			status.setAttribute('role', 'status');
			status.setAttribute('aria-live', 'polite');
			status.textContent = voterId
				? 'Votes are shared. You can change your choice later.'
				: 'Voting is unavailable because this browser could not save a voting ID.';
			form.append(submit, status);
			form.addEventListener('submit', async (event) => {
				event.preventDefault();
				const selected = form.querySelector('input:checked');
				if (!selected || !voterId) {
					return;
				}
				submit.disabled = true;
				status.textContent = 'Saving your vote...';
				try {
					const updatedPolls = await request('cast_community_poll_vote', {
						p_poll_id: poll.id,
						p_voter_id: voterId,
						p_option_id: selected.value,
					});
					try {
						window.localStorage.setItem(`east-smp-community-poll-${poll.id}`, selected.value);
					} catch (error) {
						console.warn('Unable to remember the community poll choice in this browser.', error);
					}
					renderPolls(updatedPolls);
				} catch (error) {
					status.textContent = 'Your vote could not be saved. Please try again later.';
					console.error('Unable to save community poll vote.', error);
					submit.disabled = false;
				}
			});
			card.append(heading, description, totalLabel, form);
			container.append(card);
		});
	};

	const initialize = async () => {
		try {
			voterId = getVoterId();
			renderPolls(await request('get_community_polls'));
		} catch (error) {
			container.replaceChildren();
			const message = document.createElement('p');
			message.className = 'community-polls-status';
			message.textContent = 'Community polls could not be loaded. Please try again later.';
			container.append(message);
			console.error('Unable to load community polls.', error);
		}
	};

	initialize();
})();
