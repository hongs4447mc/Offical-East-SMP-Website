(() => {
	document.querySelectorAll('.player-head[data-minecraft-name]').forEach((avatar) => {
		const playerName = avatar.dataset.minecraftName.trim();
		if (!playerName) {
			return;
		}
		const playerIdentifier = avatar.dataset.minecraftUuid || playerName;

		const image = document.createElement('img');
		image.className = 'player-head-image';
		image.alt = '';
		image.setAttribute('aria-hidden', 'true');
		image.decoding = 'async';
		image.addEventListener('load', () => {
			avatar.replaceChildren(image);
			avatar.classList.add('has-player-head');
		}, {once: true});
		image.addEventListener('error', () => {
			console.warn(`Could not load the Minecraft head for ${playerName}.`);
		}, {once: true});
		image.src = avatar.dataset.headUrl || `https://mc-heads.net/avatar/${encodeURIComponent(playerIdentifier)}/92`;
	});
})();
