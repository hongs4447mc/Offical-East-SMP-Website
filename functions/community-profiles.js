(() => {
	const list = document.querySelector('#community-profiles-list');
	const config = window.EAST_SMP_SUPABASE_CONFIG;

	if (!list || !config?.supabaseUrl || !config?.publishableKey) {
		return;
	}

	const renderProfiles = (profiles) => {
		list.replaceChildren();
		if (profiles.length === 0) {
			const empty = document.createElement('p');
			empty.className = 'role-coming-soon';
			empty.textContent = 'No public profiles yet.';
			list.append(empty);
			return;
		}

		profiles.forEach((profile) => {
			const card = document.createElement('article');
			card.className = 'role-card role-blue';
			let avatar;

			if (profile.avatar_url) {
				try {
					const imageUrl = new URL(profile.avatar_url);
					if (imageUrl.protocol === 'https:' || imageUrl.protocol === 'http:') {
						avatar = document.createElement('img');
						avatar.className = 'role-avatar role-avatar-image';
						avatar.src = imageUrl.href;
						avatar.alt = '';
						avatar.loading = 'lazy';
						avatar.referrerPolicy = 'no-referrer';
					}
				} catch (error) {
					console.warn('Ignoring an invalid community profile image URL.', error);
				}
			}

			if (!avatar) {
				avatar = document.createElement('div');
				avatar.className = 'role-avatar';
				avatar.setAttribute('aria-hidden', 'true');
				avatar.textContent = profile.display_name.trim().charAt(0).toUpperCase() || '?';
			}

			const label = document.createElement('p');
			label.className = 'role-label';
			label.textContent = 'COMMUNITY MEMBER';
			const name = document.createElement('h3');
			name.textContent = profile.display_name;
			const bio = document.createElement('p');
			bio.className = 'community-profile-bio';
			bio.textContent = profile.bio || 'East SMP community member.';
			card.append(avatar, label, name, bio);
			list.append(card);
		});
	};

	const loadProfiles = async () => {
		const query = new URLSearchParams({
			select: 'display_name,bio,avatar_url',
			is_public: 'eq.true',
			order: 'display_name.asc',
		});
		const response = await fetch(`${config.supabaseUrl}/rest/v1/community_profiles?${query}`, {
			headers: {apikey: config.publishableKey},
		});
		if (!response.ok) {
			throw new Error(`Profile request failed with HTTP ${response.status}: ${await response.text()}`);
		}
		renderProfiles(await response.json());
	};

	loadProfiles().catch((error) => {
		const message = document.createElement('p');
		message.className = 'role-coming-soon';
		message.textContent = 'Public profiles could not be loaded.';
		list.replaceChildren(message);
		console.error('Unable to load public community profiles.', error);
	});
})();
