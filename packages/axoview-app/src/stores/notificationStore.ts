import { create } from 'zustand'

export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info'

export interface NotificationAction {
  label: string
  onClick: () => void
}

export interface Notification {
  id: string
  severity: NotificationSeverity
  message: string
  action?: NotificationAction
  autoDismiss?: number
  persistent?: boolean
}

interface NotificationStore {
  queue: Notification[]
  push(n: Omit<Notification, 'id'>): void
  dismiss(id: string): void
  dismissAll(): void
}

const autoDismissDefaults: Record<NotificationSeverity, number | undefined> = {
  success: 3000,
  info: 4000,
  warning: undefined,
  error: undefined
}

// Toast ids only need to be unique within this queue. Deliberately not
// crypto.randomUUID: that API is absent outside secure contexts (plain-HTTP
// self-hosting by LAN IP), and a toast must never throw while reporting an error.
let nextNotificationSeq = 0
const nextNotificationId = () =>
  `n_${Date.now().toString(36)}_${(nextNotificationSeq++).toString(36)}`

export const useNotificationStore = create<NotificationStore>((set) => ({
  queue: [],

  push(n) {
    const autoDismiss =
      n.autoDismiss !== undefined ? n.autoDismiss : autoDismissDefaults[n.severity]
    const notification: Notification = {
      ...n,
      id: nextNotificationId(),
      autoDismiss
    }
    set((state) => ({ queue: [...state.queue, notification] }))
  },

  dismiss(id) {
    set((state) => ({ queue: state.queue.filter((n) => n.id !== id) }))
  },

  dismissAll() {
    set({ queue: [] })
  }
}))

// Imperative accessor for use outside React components
export const notificationStore = {
  push: (n: Omit<Notification, 'id'>) => useNotificationStore.getState().push(n),
  dismiss: (id: string) => useNotificationStore.getState().dismiss(id),
  dismissAll: () => useNotificationStore.getState().dismissAll()
}
