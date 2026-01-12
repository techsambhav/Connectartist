// Token refresh utility for frontend
class TokenManager {
  constructor() {
    this.refreshPromise = null;
  }

  // Check if token is expired or will expire soon
  isTokenExpired(token) {
    if (!token) return true;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      // Consider token expired if it expires within next 5 minutes
      return payload.exp < (currentTime + 300);
    } catch (e) {
      return true;
    }
  }

  // Get token from localStorage
  getToken() {
    return localStorage.getItem('token');
  }

  // Set token in localStorage
  setToken(token) {
    localStorage.setItem('token', token);
  }

  // Remove token from localStorage
  removeToken() {
    localStorage.removeItem('token');
  }

  // Refresh token
  async refreshToken() {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this._doRefresh();
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }

  async _doRefresh() {
    const token = this.getToken();
    if (!token) {
      throw new Error('No token to refresh');
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.token) {
          this.setToken(data.token);
          return data.token;
        }
      }
      
      // If refresh failed, remove invalid token
      this.removeToken();
      throw new Error('Token refresh failed');
    } catch (error) {
      this.removeToken();
      throw error;
    }
  }

  // Enhanced fetch that automatically handles token refresh
  async fetchWithAuth(url, options = {}) {
    let token = this.getToken();
    
    // Check if token needs refresh
    if (this.isTokenExpired(token)) {
      try {
        token = await this.refreshToken();
      } catch (error) {
        // Redirect to login if refresh fails
        window.location.href = '/login.html';
        throw error;
      }
    }

    // Add authorization header
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    // If we get 401, try to refresh token once
    if (response.status === 401) {
      try {
        token = await this.refreshToken();
        const retryResponse = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${token}`
          }
        });
        return retryResponse;
      } catch (error) {
        // Redirect to login if refresh fails
        window.location.href = '/login.html';
        throw error;
      }
    }

    return response;
  }
}

// Create global instance
window.tokenManager = new TokenManager();

// Utility function for easy access
window.fetchWithAuth = (url, options) => window.tokenManager.fetchWithAuth(url, options);