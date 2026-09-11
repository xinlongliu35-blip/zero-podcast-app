import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mockFolders } from '../data/mockData';

export const useStore = create(
  persist(
    (set) => ({
      notes: [],
      folders: mockFolders,
      settings: {
        apiKey: '',
        voice: 'gentle',
        englishEnabled: false,
        haptic: true,
        customPrompt: '', // 用户自定义提示词（追加到系统提示词后）
        promptMode: 'default', // default / critical / deep / custom
      },
      isInputModalOpen: false,
      skipSplashScreen: false,
      currentTutorialStep: 1,
      learningStreak: 1,
      lastActiveDate: new Date().toLocaleDateString(),
      
      addNote: (note) => set((state) => {
        // Update streak logic
        const today = new Date().toLocaleDateString();
        let newStreak = state.learningStreak;
        if (state.lastActiveDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          if (state.lastActiveDate === yesterday.toLocaleDateString()) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        }
        return { 
          notes: [note, ...state.notes],
          learningStreak: newStreak,
          lastActiveDate: today
        };
      }),
      deleteNote: (id) => set((state) => ({
        notes: state.notes.filter(n => n.id !== id)
      })),
      updateNote: (id, updates) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, ...updates } : n)
      })),
      updateNoteField: (id, field, value) => set((state) => ({
        notes: state.notes.map(n => n.id === id ? { ...n, [field]: value } : n)
      })),
      updateSettings: (newSettings) => set((state) => ({ 
        settings: { ...state.settings, ...newSettings } 
      })),
      setInputModalOpen: (isOpen) => set({ isInputModalOpen: isOpen }),
      setSkipSplashScreen: (skip) => set({ skipSplashScreen: skip }),
      setTutorialStep: (step) => set({ currentTutorialStep: step }),
      updateStreak: () => set((state) => {
        const today = new Date().toLocaleDateString();
        if (state.lastActiveDate === today) return state;
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const newStreak = state.lastActiveDate === yesterday.toLocaleDateString() ? state.learningStreak + 1 : 1;
        return { learningStreak: newStreak, lastActiveDate: today };
      })
    }),
    {
      name: 'zero-storage',
    }
  )
);
