(() => {
	const protagonistVoteForm = document.querySelector('#protagonist-vote-form');

	if (protagonistVoteForm) {
		const voteStatus = document.querySelector('#vote-status');
		const totalVotes = document.querySelector('#total-votes');
		const voteInputs = [...protagonistVoteForm.querySelectorAll('input[name="protagonist"]')];
		const submitButton = protagonistVoteForm.querySelector('.vote-submit');
		const voterIdStorageKey = 'east-smp-voter-id';
		const savedVoteStorageKey = 'east-smp-protagonist-global-vote';
		const choices = voteInputs.map((input) => input.value);
		const config = window.EAST_SMP_SUPABASE_CONFIG;
		const supabaseUrl = typeof config?.supabaseUrl === 'string' ? config.supabaseUrl.replace(/\/+$/, '') : '';
		const publishableKey = typeof config?.publishableKey === 'string' ? config.publishableKey.trim() : '';

		const renderVoteCounts = (counts) => {
			let total = 0;

			for (const choice of choices) {
				const count = counts[choice];

				if (!Number.isSafeInteger(count) || count < 0) {
					throw new Error(`The voting service returned an invalid count for ${choice}.`);
				}

				document.querySelector(`#vote-count-${choice}`).textContent = `${count} ${count === 1 ? 'vote' : 'votes'}`;
				total += count;
			}

			totalVotes.textContent = String(total);
		};

		const callVotingFunction = async (functionName, payload) => {
			const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
				method: 'POST',
				headers: {
					apikey: publishableKey,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const details = await response.text();
				throw new Error(`Voting service returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
			}

			return response.json();
		};

		const getVoterId = () => {
			const storage = window.localStorage;
			const storedId = storage.getItem(voterIdStorageKey);
			const uuidPattern = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

			if (storedId && uuidPattern.test(storedId)) {
				return storedId;
			}

			if (!window.crypto?.randomUUID) {
				throw new Error('This browser cannot create a secure voting ID.');
			}

			const voterId = window.crypto.randomUUID();
			storage.setItem(voterIdStorageKey, voterId);
			return voterId;
		};

		if (!supabaseUrl || !publishableKey) {
			voteStatus.textContent = 'Shared voting needs a Supabase project. Follow the setup steps in supabase/README.md.';
			return;
		}

		let voterId;

		try {
			voterId = getVoterId();
		} catch (error) {
			voteStatus.textContent = 'This browser could not prepare a voting ID. Check browser storage and try again.';
			console.error('Unable to prepare the East SMP voting ID.', error);
			return;
		}

		const savedVote = window.localStorage.getItem(savedVoteStorageKey);
		const savedInput = voteInputs.find((input) => input.value === savedVote);

		if (savedInput) {
			savedInput.checked = true;
		}

		const loadVoteCounts = async () => {
			try {
				const counts = await callVotingFunction('get_protagonist_vote_counts', {});
				renderVoteCounts(counts);
				voteInputs.forEach((input) => {
					input.disabled = false;
				});
				submitButton.disabled = false;
				voteStatus.textContent = savedInput
					? `Your vote for ${savedInput.nextElementSibling.querySelector('.vote-name').textContent.trim()} is saved. You can change it at any time.`
					: 'Votes and totals are shared with everyone. You can change your vote at any time.';
			} catch (error) {
				voteStatus.textContent = 'Could not load shared vote totals. Please try again later.';
				console.error('Unable to load East SMP vote totals.', error);
			}
		};

		protagonistVoteForm.addEventListener('submit', async (event) => {
			event.preventDefault();

			const selectedVote = voteInputs.find((input) => input.checked);

			if (!selectedVote) {
				voteStatus.textContent = 'Choose a protagonist before saving your vote.';
				return;
			}

			submitButton.disabled = true;
			voteStatus.textContent = 'Saving your vote...';

			try {
				const counts = await callVotingFunction('cast_protagonist_vote', {
					p_voter_id: voterId,
					p_choice: selectedVote.value,
				});
				renderVoteCounts(counts);
				voteStatus.textContent = `Your vote for ${selectedVote.nextElementSibling.querySelector('.vote-name').textContent.trim()} is saved and shared with everyone.`;

				try {
					window.localStorage.setItem(savedVoteStorageKey, selectedVote.value);
				} catch (error) {
					console.warn('Unable to remember the selected East SMP vote in this browser.', error);
				}
			} catch (error) {
				voteStatus.textContent = 'Your vote could not be saved. Please try again later.';
				console.error('Unable to save the East SMP vote.', error);
			} finally {
				submitButton.disabled = false;
			}
		});

		loadVoteCounts();
	}
})();
