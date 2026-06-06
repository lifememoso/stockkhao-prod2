import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  sessionId: null,

  login: (userData, session) => set({ 
    user: userData, 
    sessionId: session
  }),
  
  logout: () => set({ 
    user: null, 
    sessionId: null 
  }),
}));