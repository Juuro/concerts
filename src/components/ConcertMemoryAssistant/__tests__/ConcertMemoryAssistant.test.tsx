import { describe, test, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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
})
