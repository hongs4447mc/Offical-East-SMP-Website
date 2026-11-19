const copyrightYear = document.querySelector('#copyright-year');
if (copyrightYear) {
	copyrightYear.textContent = String(new Date().getFullYear());
}

document.querySelectorAll('.copy-ip-button[data-copy-target]').forEach((copyServerIpButton) => {
	const serverAddress = document.querySelector(`#${copyServerIpButton.dataset.copyTarget}`);
	const copyStatus = document.querySelector(`#${copyServerIpButton.dataset.statusTarget}`);

	if (!serverAddress || !copyStatus) {
		return;
	}

	copyServerIpButton.addEventListener('click', async () => {
		const address = serverAddress.textContent?.trim();

		if (!address) {
			copyStatus.textContent = 'Server address is unavailable.';
			return;
		}

		if (!navigator.clipboard?.writeText) {
			copyStatus.textContent = 'Clipboard access is unavailable. Select the address to copy.';
			return;
		}

		try {
			await navigator.clipboard.writeText(address);
			copyStatus.textContent = 'Server address copied.';
		} catch (error) {
			copyStatus.textContent = 'Could not copy automatically. Select the address to copy.';
			console.error('Unable to copy the server address.', error);
		}
	});
});

