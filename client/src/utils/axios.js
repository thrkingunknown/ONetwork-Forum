import axios from "axios";

// Use a relative baseURL so that requests are made to the same origin
// as the frontend (Vite dev server), allowing the Vite proxy to handle them.
const instance = axios.create({
  baseURL: "/", // Or an empty string if all your requests are absolute paths like '/api/...'
  withCredentials: true,
  timeout: 10000,
  // The 'delayed' interceptor seems custom for simulating network latency.
  // Keep it if it's intentional.
  // delayed: true,
});

instance.interceptors.request.use(
  (config) => {
    // Example of custom 'delayed' property processing
    if (config.delayed) {
      return new Promise((resolve) => setTimeout(() => {
        delete config.delayed; // Remove property after processing
        resolve(config);
      }, 1000));
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (res) => {
    return res;
  },
  async (err) => {
    const originalConfig = err.config;

    // Check if the error is due to an expired token (e.g., 401 Unauthorized)
    // and if the request hasn't been retried yet.
    if (err.response && err.response.status === 401 && !originalConfig._retry) {
      originalConfig._retry = true; // Mark that we've attempted a retry

      try {
        // Attempt to refresh the token.
        // The '/refresh_token' endpoint should be handled by the Vite proxy.
        const { data } = await instance.get("/refresh_token");

        // Update the default Authorization header for subsequent requests
        // and the header for the original failed request.
        // Note: Storing token in axios defaults might not be the best global state management.
        // Consider using a more robust solution for token management if needed.
        if (data && data.token) {
          instance.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
          originalConfig.headers["Authorization"] = `Bearer ${data.token}`;

          // Retry the original request with the new token
          return instance(originalConfig);
        } else {
          // If refresh token endpoint doesn't return a token, reject.
          // This could mean the refresh token itself is invalid/expired.
          // Redirect to login or clear session state here.
          // For now, just rejecting.
          if (typeof window !== 'undefined') { // Check if running in browser
             // Example: window.location.href = '/login';
          }
          return Promise.reject(new Error("Failed to refresh token, no new token received."));
        }

      } catch (_error) {
        // If refreshing the token fails, reject the promise.
        // This could involve redirecting to a login page or clearing user session.
        // console.error("Error refreshing token:", _error);
        if (typeof window !== 'undefined') {
           // Example: window.location.href = '/login'; // Or dispatch a logout action
        }
        // Pass along the error from the refresh token attempt, or a more specific error
        return Promise.reject(_error.response && _error.response.data ? _error.response.data : _error);
      }
    }

    // For errors not related to 401 or if retry already attempted, just reject.
    return Promise.reject(err);
  }
);

export default instance;
