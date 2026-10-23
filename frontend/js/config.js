const isLocalFrontend = ['localhost', '127.0.0.1'].includes(
    window.location.hostname
);

window.API_BASE_URL = isLocalFrontend
    ? 'http://localhost:8080'
    : 'https://wichitsiam-production.up.railway.app';
