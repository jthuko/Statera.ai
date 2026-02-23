// src/context/NotificationContext.tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface AppNotification {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string; // ISO
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (message: string, type?: AppNotification["type"]) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const KEY = "statera:notifications";
const MAX = 50;

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Persist on every change
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(notifications.slice(0, MAX))); } catch {}
  }, [notifications]);

  const addNotification = useCallback((message: string, type: AppNotification["type"] = "info") => {
    const n: AppNotification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      message,
      type,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [n, ...prev].slice(0, MAX));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAllRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
