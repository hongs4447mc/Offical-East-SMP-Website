const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('#site-nav');

document.addEventListener('keydown', (event) => {
	if (event.ctrlKey && event.altKey && event.shiftKey && event.code === 'KeyT' && !event.repeat) {
		event.preventDefault();
		window.location.href = new URL('admin.html', window.location.href).href;
	}
});

if (menuToggle && siteNav) {
	const closeMenu = () => {
		menuToggle.setAttribute('aria-expanded', 'false');
		siteNav.classList.remove('is-open');
	};

	menuToggle.addEventListener('click', () => {
		const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
		menuToggle.setAttribute('aria-expanded', String(!isExpanded));
		siteNav.classList.toggle('is-open', !isExpanded);
	});

	siteNav.addEventListener('click', (event) => {
		if (event.target instanceof Element && event.target.closest('a')) {
			closeMenu();
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeMenu();
		}
	});

	document.addEventListener('click', (event) => {
		if (event.target instanceof Node && !menuToggle.contains(event.target) && !siteNav.contains(event.target)) {
			closeMenu();
		}
	});
}
