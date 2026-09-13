// The welcome screen stays visible; its link opens the shared login page.
const welcomeLoginLink = document.getElementById('aperture-btn');
const welcomeLoginParams = new URLSearchParams(window.location.search);
welcomeLoginParams.delete('opened');
const welcomeLoginUrl = new URL(welcomeLoginLink.href);
welcomeLoginUrl.search = welcomeLoginParams.toString();
welcomeLoginLink.href = welcomeLoginUrl.href;