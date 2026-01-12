function apiBase(path) {
    try {
        const override = localStorage.getItem('API_BASE');
        if (override) return override + path;
    } catch {}
    try {
        if (window.location.origin && window.location.origin.startsWith('http')) {
            if (window.location.hostname === 'localhost' && window.location.port !== '5000') {
                return 'https://localhost:5000' + path;
            }
            return path;
        }
    } catch {}
    return 'https://localhost:5000' + path;
}

async function saveProfile() {
    const token = localStorage.getItem('token'); // ensure token read at time of submit
    const fd = new FormData(document.querySelector('#profileForm')); // adjust selector if needed

    // use base URL and attach Authorization header
    const res = await fetch(apiBase('/api/profile/save'), {
        method: 'POST',
        headers: token ? { 'Authorization': 'Bearer ' + token } : {},
        credentials: 'include',
        body: fd
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText} - ${text}`);
    }
    const json = await res.json();
    // ...existing success handling...
}