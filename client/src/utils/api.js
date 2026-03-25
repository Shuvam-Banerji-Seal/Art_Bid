import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
});

// Attach CSRF token to all state-changing requests
function getCsrfTokenFromCookie() {
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

api.interceptors.request.use(async (config) => {
  const mutating = ['post', 'patch', 'put', 'delete'];
  if (mutating.includes((config.method || '').toLowerCase())) {
    let token = getCsrfTokenFromCookie();
    if (!token) {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL || '/api'}/csrf-token`,
          { withCredentials: true }
        );
        token = res.data.csrfToken;
      } catch {
        // proceed without CSRF token (server will still validate Origin)
      }
    }
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    }
  }
  return config;
});

export default api;
