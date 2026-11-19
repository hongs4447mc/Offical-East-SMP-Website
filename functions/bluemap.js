(() => {
	const mapFrame = document.querySelector('#bluemap-frame');
	const mapNotice = document.querySelector('#bluemap-notice');
	const mapNoticeLabel = document.querySelector('#bluemap-notice-label');
	const mapNoticeTitle = document.querySelector('#bluemap-notice-title');
	const mapNoticeText = document.querySelector('#bluemap-notice-text');
	const openMapLink = document.querySelector('#bluemap-open-link');
	const configuredUrl = window.EAST_SMP_BLUEMAP_CONFIG?.mapUrl?.trim();

	if (!mapFrame || !mapNotice || !mapNoticeLabel || !mapNoticeTitle || !mapNoticeText || !openMapLink) {
		return;
	}

	if (!configuredUrl) {
		mapNotice.hidden = false;
		return;
	}

	let mapUrl;
	try {
		mapUrl = new URL(configuredUrl);
	} catch (error) {
		mapNoticeLabel.textContent = 'MAP CONFIGURATION';
		mapNoticeTitle.textContent = 'BlueMap URL needs attention';
		mapNoticeText.textContent = 'The BlueMap URL is invalid. Check functions/bluemap-config.js.';
		mapNotice.hidden = false;
		console.error('The configured BlueMap URL is invalid.', error);
		return;
	}

	if (!['https:', 'http:'].includes(mapUrl.protocol)) {
		mapNoticeLabel.textContent = 'MAP CONFIGURATION';
		mapNoticeTitle.textContent = 'BlueMap URL needs attention';
		mapNoticeText.textContent = 'The BlueMap URL must use HTTPS or HTTP.';
		mapNotice.hidden = false;
		console.error('The configured BlueMap URL must use HTTPS or HTTP.');
		return;
	}

	openMapLink.href = mapUrl.href;
	openMapLink.hidden = false;

	if (window.location.protocol === 'https:' && mapUrl.protocol !== 'https:') {
		mapNoticeLabel.textContent = 'MAP LINK';
		mapNoticeTitle.textContent = 'Open BlueMap in a new tab';
		mapNoticeText.textContent = 'This map uses HTTP, so browsers cannot embed it in the secure website. Use the open-map button, or configure HTTPS for BlueMap.';
		mapNotice.hidden = false;
		return;
	}

	mapFrame.src = mapUrl.href;
	mapFrame.hidden = false;
	mapNotice.hidden = true;
})();
