"use client"

import React, { useCallback, useEffect, useState } from "react"
import "./toast.scss"

export interface ToastProps {
  message: string
  type?: "error" | "success" | "info"
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  onClose?: () => void
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "info",
  action,
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isExiting, setIsExiting] = useState(false)

  const triggerClose = useCallback(() => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, 200)
  }, [isExiting, onClose])

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        triggerClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, triggerClose])

  if (!isVisible) return null

  return (
    <div className={`toast toast--${type} ${isExiting ? "toast--exiting" : ""}`} role="alert">
      <span className="toast__message">{message}</span>
      <div className="toast__actions">
        {action && (
          <button
            type="button"
            className="toast__action-btn"
            onClick={() => {
              action.onClick()
              triggerClose()
            }}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          className="toast__close-btn"
          onClick={triggerClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}

// Toast container for managing multiple toasts
interface ToastItem extends ToastProps {
  id: string
}

interface ToastContextValue {
  showToast: (props: Omit<ToastProps, "onClose">) => void
}

export const ToastContext = React.createContext<ToastContextValue | null>(null)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = (props: Omit<ToastProps, "onClose">) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { ...props, id }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = (): ToastContextValue => {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export default Toast
