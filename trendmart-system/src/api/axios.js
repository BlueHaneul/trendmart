import axios from 'axios';

const API = axios.create({
  // Use the configured URL if set; otherwise call the backend on whichever host served this page,
  // so the same build works on localhost and when opened from another device via the LAN IP.
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000/api`,
});

// Attach the JWT to every outgoing request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global 401/403 handling — token expired or invalid
API.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 from the login request just means wrong credentials, not an expired session
    const isLoginRequest = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default API;
