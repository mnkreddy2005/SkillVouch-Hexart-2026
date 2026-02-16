import { User, ExchangeRequest, Message, ExchangeFeedback } from '../types';
import { suggestSkillsDirect, generateRoadmapDirect } from './mistralDirectService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }

  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const bytes = new Uint8Array(16);
    (crypto as any).getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
    return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const apiService = {
  getCurrentSession: (): User | null => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        return userData;
      }
    } catch (error) {
      console.warn('Error reading session from localStorage:', error);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    return null;
  },

  setSession: (user: User) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", "session-token-" + user.id);
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  },

  saveUser: async (user: User) => {
    const response = await fetch(`${API_URL}/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    if (!response.ok) throw new Error('Failed to save user');
  },

  login: async (email: string, password: string): Promise<User> => {
    await delay(100);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Invalid email or password');
      }

      const data = await response.json();
      const user = data.user;

      localStorage.setItem("user", JSON.stringify(user));
      if (data.token) {
        localStorage.setItem("token", data.token);
      }

      apiService.setSession(user);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  signup: async (name: string, email: string, password: string): Promise<User> => {
    await delay(200);

    try {
      const userId = generateId();
      const response = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: userId,
          name,
          email,
          password,
          skillsKnown: [],
          skillsToLearn: []
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Signup failed');
      }

      const user = await response.json();
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", "signup-token-" + user.id);
      return user;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await fetch(`${API_URL}/api/users/${id}`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  getUsers: async (): Promise<User[]> => {
    const response = await fetch(`${API_URL}/api/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return response.json();
  },

  getRequests: async (userId: string): Promise<ExchangeRequest[]> => {
    const response = await fetch(`${API_URL}/api/requests?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch requests');
    return response.json();
  },

  createRequest: async (request: Omit<ExchangeRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>): Promise<ExchangeRequest> => {
    const response = await fetch(`${API_URL}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!response.ok) throw new Error('Failed to create request');
    return response.json();
  },

  updateRequestStatus: async (id: string, status: string): Promise<ExchangeRequest> => {
    const response = await fetch(`${API_URL}/api/requests/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!response.ok) throw new Error('Failed to update request');
    return response.json();
  },

  submitFeedback: async (feedback: Omit<ExchangeFeedback, 'id' | 'createdAt'>): Promise<ExchangeFeedback> => {
    const response = await fetch(`${API_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedback)
    });
    if (!response.ok) throw new Error('Failed to submit feedback');
    return response.json();
  },

  getReceivedFeedback: async (userId: string): Promise<ExchangeFeedback[]> => {
    const response = await fetch(`${API_URL}/api/feedback/received?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch feedback');
    return response.json();
  },

  getFeedbackStats: async (userId: string): Promise<{ avgStars: number; count: number }> => {
    const response = await fetch(`${API_URL}/api/feedback/stats?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch feedback stats');
    return response.json();
  },

  sendMessage: async (senderId: string, receiverId: string, content: string): Promise<Message> => {
    const response = await fetch(`${API_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId, receiverId, content })
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  getConversation: async (user1Id: string, user2Id: string): Promise<Message[]> => {
    const response = await fetch(`${API_URL}/api/messages/conversation?user1Id=${user1Id}&user2Id=${user2Id}`);
    if (!response.ok) throw new Error('Failed to fetch conversation');
    return response.json();
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    const response = await fetch(`${API_URL}/api/messages/unread-count?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch unread count');
    const data = await response.json();
    return data.unreadCount || 0;
  },

  markAsRead: async (userId: string, senderId: string) => {
    await fetch(`${API_URL}/api/messages/mark-as-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, senderId })
    });
  },

  getConversations: async (userId: string): Promise<User[]> => {
    const response = await fetch(`${API_URL}/api/conversations?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
  },

  generateQuiz: async (skill: string, difficulty: string) => {
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempt ${retryCount + 1}: Generating quiz for ${skill} (${difficulty})`);

        const response = await fetch(`${API_URL}/api/quizzes/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skill, difficulty })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error (attempt ${retryCount + 1}):`, response.status, errorText);

          if (retryCount === maxRetries - 1) {
            throw new Error(`Failed to generate quiz: ${response.status} ${errorText}`);
          }

          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }

        const data = await response.json();
        console.log('Quiz generated successfully:', data);
        return data;

      } catch (error) {
        console.error(`Quiz generation error (attempt ${retryCount + 1}):`, error);

        if (retryCount === maxRetries - 1) {
          throw new Error('Failed to generate quiz. Please try again.');
        }

        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    throw new Error('Failed to generate quiz after multiple attempts');
  },

  submitQuiz: async (userId: string, quizId: string, answers: number[]) => {
    const response = await fetch(`${API_URL}/api/quizzes/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, quizId, answers })
    });
    if (!response.ok) throw new Error('Failed to submit quiz');
    return response.json();
  },

  suggestSkills: async (currentSkills: string[], currentGoals: string[] = []) => {
    try {
      const response = await fetch(`${API_URL}/api/skills/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSkills, currentGoals })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to suggest skills: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Skills suggested successfully:', data);
      return data;
    } catch (error) {
      console.error('Skill suggestion failed:', error);
      throw new Error('Failed to suggest skills. Please try again.');
    }
  },

  generateRoadmap: async (skill: string) => {
    try {
      const response = await fetch(`${API_URL}/api/roadmap/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate roadmap: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('Roadmap generated successfully:', data);
      return data;
    } catch (error) {
      console.error('Roadmap generation failed:', error);
      throw new Error('Failed to generate roadmap. Please try again.');
    }
  }
};
