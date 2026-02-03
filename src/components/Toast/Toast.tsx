"use client"

import React, { useEffect, useState } from "react"
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

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        onClose?.()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (!isVisible) return null

  return (
    <div className={`toast toast--${type}`} role="alert">
      <span className="toast__message">{message}</span>
      <div className="toast__actions">
        {action && (
          <button
            type="button"
            className="toast__action-btn"
            onClick={() => {
              action.onClick()
              handleClose()
            }}
          >
            {action.label}
          </button>
        )}
        <button
          type="button"
          className="toast__close-btn"
          onClick={handleClose}
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
