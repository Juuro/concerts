import { describe, test, expect, beforeEach, afterEach, vi } from "vitest"
import { act, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ToastProvider } from "@/components/Toast/Toast"
import ConcertMemoryAssistant from "../ConcertMemoryAssistant"
import type { CandidateShow } from "@/types/concertAiSearch"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const fetchMock = vi.fn()

function makeRes(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response
}

function candidate(over: Partial<CandidateShow> = {}): CandidateShow {
  return {
    id: "s1",
    date: "1999-07-11",
    venue: "Wembley Stadium",
    city: "London",
    country: "United Kingdom",
    headliner: "The Rolling Stones",
    artistMbid: null,
    lat: 51.55,
    lon: -0.28,
    setlistUrl: null,
    alreadyAdded: false,
    editPath: null,
    ...over,
  }
}

function renderPanel() {
  return render(
    <ToastProvider>
      <ConcertMemoryAssistant />
    </ToastProvider>
  )
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("ConcertMemoryAssistant", () => {
  test("renders idle and enables the submit only with enough text", async () => {
    const user = userEvent.setup()
    renderPanel()

    expect(
      screen.getByRole("heading", { name: /help me remember/i })
    ).toBeInTheDocument()

    const submit = screen.getByRole("button", { name: /find concert/i })
    expect(submit).toBeDisabled()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    expect(submit).toBeEnabled()
  })

  test("shows candidate cards after a search", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      makeRes({ candidates: [candidate()], parsed: null, hint: null })
    )
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(await screen.findByText("The Rolling Stones")).toBeInTheDocument()
    expect(screen.getByText("Wembley Stadium")).toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /add concert: the rolling stones/i,
      })
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/concerts/ai-search",
      expect.objectContaining({ method: "POST" })
    )
  })

  test("shows the refine hint when nothing is found", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      makeRes({
        candidates: [],
        parsed: null,
        hint: "Add a city to narrow it down.",
      })
    )
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Some obscure band"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(
      await screen.findByText(/add a city to narrow it down/i)
    ).toBeInTheDocument()
  })

  test("one-click add records the show in the session list", async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(
        makeRes({ candidates: [candidate()], parsed: null, hint: null })
      )
      .mockResolvedValueOnce(
        makeRes(
          {
            concertId: "c1",
            editPath: "/concerts/edit/c1",
            summary: {
              toast: "Added The Rolling Stones — Wembley Stadium, 11 Jul 1999",
            },
          },
          201
        )
      )
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))
    await user.click(
      await screen.findByRole("button", {
        name: /add concert: the rolling stones/i,
      })
    )

    expect(await screen.findByText(/added this session/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/concerts/from-setlist",
      expect.objectContaining({ method: "POST" })
    )
  })

  test("recovers from search timeout instead of staying stuck in thinking state", async () => {
    vi.useFakeTimers()

    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted")
            err.name = "AbortError"
            reject(err)
          })
        })
    )
    renderPanel()

    fireEvent.change(screen.getByLabelText(/what do you remember/i), {
      target: { value: "Rolling Stones London 99" },
    })
    fireEvent.click(screen.getByRole("button", { name: /find concert/i }))

    expect(screen.getByRole("button", { name: /searching/i })).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000)
    })

    expect(screen.getByText(/search took too long/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /find concert/i })).toBeEnabled()
  })

  test("already-added candidates render a disabled-equivalent state", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      makeRes({
        candidates: [
          candidate({ alreadyAdded: true, editPath: "/concerts/edit/c9" }),
        ],
        parsed: null,
        hint: null,
      })
    )
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(await screen.findByText(/already in your list/i)).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /add concert/i })
    ).not.toBeInTheDocument()
  })

  test("submits on Cmd+Enter and clears results on Escape", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      makeRes({ candidates: [candidate()], parsed: null, hint: null })
    )
    renderPanel()

    const textarea = screen.getByLabelText(/what do you remember/i)
    await user.type(textarea, "Rolling Stones London 99")
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true })

    expect(await screen.findByText("The Rolling Stones")).toBeInTheDocument()

    fireEvent.keyDown(textarea, { key: "Escape" })
    expect(screen.queryByText("The Rolling Stones")).not.toBeInTheDocument()
  })

  test("shows rate-limit and generic search errors", async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(makeRes({}, 429))
      .mockResolvedValueOnce(makeRes({}, 500))
    renderPanel()

    const textarea = screen.getByLabelText(/what do you remember/i)
    await user.type(textarea, "Rolling Stones London 99")
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(await screen.findByText(/too many searches/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /try again/i }))

    expect(
      await screen.findByText(/something went wrong searching/i)
    ).toBeInTheDocument()
  })

  test("shows a connection error when search fetch rejects", async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new Error("network down"))
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(
      await screen.findByText(/couldn't reach the search/i)
    ).toBeInTheDocument()
  })

  test("handles duplicate add responses and add failures", async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(
        makeRes({ candidates: [candidate()], parsed: null, hint: null })
      )
      .mockResolvedValueOnce(
        makeRes({ editPath: "/concerts/edit/existing" }, 409)
      )
      .mockResolvedValueOnce(
        makeRes({
          candidates: [candidate({ id: "s2" })],
          parsed: null,
          hint: null,
        })
      )
      .mockResolvedValueOnce(makeRes({ error: "Server exploded" }, 500))
      .mockResolvedValueOnce(
        makeRes({
          candidates: [candidate({ id: "s3" })],
          parsed: null,
          hint: null,
        })
      )
      .mockRejectedValueOnce(new Error("offline"))

    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    await user.click(
      await screen.findByRole("button", {
        name: /add concert: the rolling stones/i,
      })
    )
    expect(
      await screen.findByText(/that concert is already in your list/i)
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /find concert/i }))
    await user.click(
      await screen.findByRole("button", {
        name: /add concert: the rolling stones/i,
      })
    )
    expect(await screen.findByText(/server exploded/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /find concert/i }))
    await user.click(
      await screen.findByRole("button", {
        name: /add concert: the rolling stones/i,
      })
    )
    expect(
      await screen.findByText(
        /couldn't add that concert\. check your connection/i
      )
    ).toBeInTheDocument()
  })

  test("announces singular match count in the live region", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(
      makeRes({ candidates: [candidate()], parsed: null, hint: null })
    )
    renderPanel()

    await user.type(
      screen.getByLabelText(/what do you remember/i),
      "Rolling Stones London 99"
    )
    await user.click(screen.getByRole("button", { name: /find concert/i }))

    expect(await screen.findByText("1 match found")).toBeInTheDocument()
  })
})
