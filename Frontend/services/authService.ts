export const authService = {
  getStoredUser: (): any | null => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      if (storedUser && storedToken) {
        return JSON.parse(storedUser);
      }
    } catch (error) {
      console.warn('Invalid stored user data, clearing...');
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    return null;
  },

  setStoredUser: (user: any) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", "auth-token-" + user.id);
  },

  clearStoredUser: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
  },

  isAuthenticated: (): boolean => {
    const user = authService.getStoredUser();
    return user !== null && user.id !== undefined;
  }
};
