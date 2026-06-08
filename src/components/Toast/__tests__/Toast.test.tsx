import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import Toast, { ToastProvider, useToast } from "@/components/Toast/Toast"

function ToastConsumer({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useToast>) => void
}) {
  const api = useToast()
  onReady(api)
  return null
}

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("renders the message with the correct type class", () => {
    render(<Toast message="Saved" type="success" duration={0} />)
    expect(screen.getByRole("alert")).toHaveClass("toast--success")
    expect(screen.getByText("Saved")).toBeInTheDocument()
  })

  test("closes when the close button is clicked", async () => {
    const onClose = vi.fn()
    render(<Toast message="Done" duration={0} onClose={onClose} />)

    fireEvent.click(screen.getByRole("button", { name: /close/i }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("auto-dismisses after the configured duration", async () => {
    const onClose = vi.fn()
    render(<Toast message="Timed" duration={1000} onClose={onClose} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("runs the action callback and then closes", async () => {
    const onAction = vi.fn()
    const onClose = vi.fn()

    render(
      <Toast
        message="Conflict"
        duration={0}
        action={{ label: "Undo", onClick: onAction }}
        onClose={onClose}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Undo" }))

    expect(onAction).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("ignores repeated close triggers while exiting", async () => {
    const onClose = vi.fn()
    render(<Toast message="Once" duration={0} onClose={onClose} />)

    const closeBtn = screen.getByRole("button", { name: /close/i })
    fireEvent.click(closeBtn)
    fireEvent.click(closeBtn)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe("ToastProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test("showToast renders a toast inside the provider", async () => {
    let api: ReturnType<typeof useToast> | null = null

    render(
      <ToastProvider>
        <ToastConsumer onReady={(value) => (api = value)} />
      </ToastProvider>
    )

    act(() => {
      api!.showToast({ message: "Hello from provider", type: "info" })
    })

    expect(screen.getByText("Hello from provider")).toBeInTheDocument()
  })

  test("removes a toast after it closes", async () => {
    let api: ReturnType<typeof useToast> | null = null

    render(
      <ToastProvider>
        <ToastConsumer onReady={(value) => (api = value)} />
      </ToastProvider>
    )

    act(() => {
      api!.showToast({ message: "Temporary", duration: 0 })
    })

    fireEvent.click(screen.getByRole("button", { name: /close/i }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })

    expect(screen.queryByText("Temporary")).not.toBeInTheDocument()
  })

  test("useToast throws when used outside a provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

    expect(() => render(<ToastConsumer onReady={() => {}} />)).toThrow(
      /must be used within a ToastProvider/i
    )

    consoleError.mockRestore()
  })
})
