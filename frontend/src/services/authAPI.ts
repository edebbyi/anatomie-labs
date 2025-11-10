import axios from 'axios';
import { API_URL } from '../config/env';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  onboardingComplete?: boolean;
  preferences?: {
    style?: string | null;
    favoriteColors?: string[];
    preferredFabrics?: string[];
  };
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
  };
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

class AuthAPI {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage if available
    this.token = localStorage.getItem('authToken');
  }

  /**
   * Persist session data in localStorage for routing logic
   */
  private persistSession(user: User, token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.saveUserProfile(user);
  }

  /**
   * Keep a lightweight copy of onboarding status to drive redirects
   */
  private saveUserProfile(user: User) {
    if (!user) return;

    const profilePayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      onboardingComplete: Boolean(user.onboardingComplete),
      timestamp: new Date().toISOString()
    };

    localStorage.setItem('userProfile', JSON.stringify(profilePayload));
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    try {
      console.log('🚀 AuthAPI: Making registration request to:', `${API_URL}/auth/register`);
      console.log('📊 AuthAPI: Request data:', { ...data, password: '[HIDDEN]' });

      const response = await axios.post<AuthResponse>(
        `${API_URL}/auth/register`,
        data,
        {
          timeout: 30000, // 30 second timeout
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ AuthAPI: Registration response received:', {
        status: response.status,
        success: response.data.success,
        hasUser: !!response.data.data?.user,
        hasToken: !!response.data.data?.token
      });

      if (response.data.success && response.data.data.token) {
        this.persistSession(response.data.data.user, response.data.data.token);
        console.log('💾 AuthAPI: Token, user data, and profile saved to localStorage');
      }

      return response.data;
    } catch (error: any) {
      console.error('❌ AuthAPI: Registration error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        code: error.code
      });

      // More detailed error handling
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to server. Please check if the server is running.');
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Server not found. Please check the server URL.');
      } else if (error.response?.status === 400) {
        const message = error.response.data?.message || 'Invalid registration data';
        const errors = error.response.data?.errors;
        if (errors && Array.isArray(errors)) {
          const errorMessages = errors.map((e: any) => e.msg || e.message).join(', ');
          throw new Error(`${message}: ${errorMessages}`);
        }
        throw new Error(message);
      } else if (error.response?.status === 409 || error.response?.data?.message === 'User already exists') {
        throw new Error('An account with this email already exists');
      } else if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      } else {
        throw new Error('Registration failed. Please try again.');
      }
    }
  }

  /**
   * Login user
   */
  async login(data: LoginData): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(
        `${API_URL}/auth/login`,
        data
      );

      if (response.data.success && response.data.data.token) {
        this.persistSession(response.data.data.user, response.data.data.token);
      }

      return response.data;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Login failed'
      );
    }
  }

  /**
   * Logout user
   */
  logout(): void {
    this.token = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userProfile');
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.token && !!this.getCurrentUser();
  }

  /**
   * Get auth token
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Get user profile from server
   */
  async getProfile(): Promise<User> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.get(`${API_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      return response.data.data.user;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to fetch profile'
      );
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await axios.put(`${API_URL}/auth/profile`, data, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });

      const updatedUser = response.data.data.user;
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      return updatedUser;
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to update profile'
      );
    }
  }

  /**
   * Change password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      await axios.post(
        `${API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        {
          headers: {
            Authorization: `Bearer ${this.token}`
          }
        }
      );
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || 'Failed to change password'
      );
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    if (!this.token) {
      throw new Error('Not authenticated');
    }

    try {
      await axios.delete(`${API_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${this.token}`
        }
      });
      
      // Clear local storage
      this.logout();
    } catch (error: any) {
      throw new Error(
        error.response?.data?.error || 'Failed to delete account'
      );
    }
  }
}

const authAPI = new AuthAPI();
export default authAPI;
