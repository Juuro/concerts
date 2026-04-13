import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { LastFMArtist } from "lastfm-ts-api"

// Hoisted with the mock factory so the factory does not close over a TDZ-bound const.
const { mockGetInfo, mockSearch } = vi.hoisted(() => {
  const mockGetInfo = vi.fn(
    (
      params: { artist: string; autocorrect?: 0 | 1 },
      callback: (err: any, res: any) => void
    ) => {
      // Last.fm API returns { artist: {...} } structure
      callback(null, {
        artist: {
          name: params.artist,
          url: `https://www.last.fm/music/${params.artist}`,
          image: [{ size: "large", "#text": "https://example.com/image.jpg" }],
          bio: { summary: "Test bio" },
          tags: { tag: ["indie", "rock"] },
        },
      })
    }
  )
  const mockSearch = vi.fn(
    (
      params: { artist: string; limit: number },
      callback: (err: unknown, res: unknown) => void
    ) => {
      callback(null, {
        results: {
          artistmatches: {
            artist: [{ name: params.artist, listeners: "1000" }],
          },
        },
      })
    }
  )
  return { mockGetInfo, mockSearch }
})

// Vitest 4+ requires a real `function` (or class) when code uses `new` on the mock.
vi.mock("lastfm-ts-api", () => ({
  LastFMArtist: vi.fn(function LastFMArtist(_apiKey: string, _secret?: string) {
    return { getInfo: mockGetInfo, search: mockSearch }
  }),
}))

async function loadGetArtistInfo() {
  vi.resetModules()
  const mod = await import("../lastfm")
  return mod.getArtistInfo
}

async function loadSearchLastFmArtists() {
  vi.resetModules()
  const mod = await import("../lastfm")
  return mod.searchLastFmArtists
}

describe("lastfm", () => {
  describe("getArtistInfo", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "error").mockImplementation(() => {})
      vi.unstubAllEnvs()
      mockGetInfo.mockReset()
      mockSearch.mockReset()
      mockSearch.mockImplementation(
        (
          params: { artist: string; limit: number },
          callback: (err: unknown, res: unknown) => void
        ) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: [{ name: params.artist, listeners: "1000" }],
              },
            },
          })
        }
      )
      mockGetInfo.mockImplementation(
        (
          params: { artist: string; autocorrect?: 0 | 1 },
          callback: (err: any, res: any) => void
        ) => {
          callback(null, {
            artist: {
              name: params.artist,
              url: `https://www.last.fm/music/${params.artist}`,
              image: [
                { size: "large", "#text": "https://example.com/image.jpg" },
              ],
              bio: { summary: "Test bio" },
              tags: { tag: ["indie", "rock"] },
            },
          })
        }
      )
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.mocked(console.warn).mockRestore()
      vi.mocked(console.error).mockRestore()
      vi.unstubAllEnvs()
    })

    it("test_getArtistInfo_when_feature_disabled_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "false")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      const result = await getArtistInfo("Radiohead")

      expect(result).toBeNull()
      expect(mockGetInfo).not.toHaveBeenCalled()
    })

    it("test_getArtistInfo_when_api_key_missing_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      // No LASTFM_API_KEY set
      delete process.env.LASTFM_API_KEY
      delete process.env.LASTFM_SECRET

      const result = await getArtistInfo("Radiohead")

      expect(result).toBeNull()
      expect(mockGetInfo).not.toHaveBeenCalled()
    })

    it("test_getArtistInfo_when_empty_artist_name_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      const result = await getArtistInfo("")

      expect(result).toBeNull()
      expect(mockGetInfo).not.toHaveBeenCalled()
    })

    it("test_getArtistInfo_when_api_succeeds_returns_artist_data", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      const result = await getArtistInfo("Radiohead")

      expect(mockGetInfo).toHaveBeenCalledWith(
        expect.objectContaining({ artist: "Radiohead" }),
        expect.any(Function)
      )
      expect(result).toEqual({
        name: "Radiohead",
        url: "https://www.last.fm/music/Radiohead",
        images: {
          small: null,
          medium: null,
          large: "https://example.com/image.jpg",
          extralarge: null,
          mega: null,
        },
        bio: "Test bio",
        genres: ["indie", "rock"],
      })
    })

    it("test_getArtistInfo_with_api_error_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      // Override mock to simulate API error
      mockGetInfo.mockImplementationOnce((params: any, callback: any) => {
        callback(new Error("API Error"), null)
      })

      const result = await getArtistInfo("NonExistentBand")

      expect(result).toBeNull()
    })

    it("test_getArtistInfo_with_secret_uses_two_arg_constructor_and_cache_hit_skips_second_call", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")
      vi.stubEnv("LASTFM_SECRET", "secret")

      const first = await getArtistInfo("The National")
      const second = await getArtistInfo(" the national ")

      expect(first?.name).toBe("The National")
      expect(second?.name).toBe("The National")
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_pending_requests_dedupes_concurrent_calls", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((params: any, callback: any) => {
        setTimeout(() => {
          callback(null, {
            artist: {
              name: params.artist,
              url: "u",
              image: [],
              bio: {},
              tags: { tag: [] },
            },
          })
        }, 10)
      })

      const p1 = getArtistInfo("Slow Band")
      const p2 = getArtistInfo("slow band")
      const [r1, r2] = await Promise.all([p1, p2])

      expect(r1?.name).toBe("Slow Band")
      expect(r2?.name).toBe("Slow Band")
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_artist_not_found_code_returns_null_and_warns", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Artist not found (Code 6)"), null)
      })

      const result = await getArtistInfo("Missing Artist")
      expect(result).toBeNull()
      expect(console.warn).toHaveBeenCalled()
    })

    it("test_getArtistInfo_artist_not_found_code_7_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Not found (Code 7)"), null)
      })

      const result = await getArtistInfo("Missing Seven")
      expect(result).toBeNull()
    })

    it("test_getArtistInfo_invalid_key_code_returns_null_without_retry", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "bad-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Bad API key (Code 10)"), null)
      })

      const result = await getArtistInfo("Any Artist")
      expect(result).toBeNull()
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_rate_limit_triggers_retry_and_allows_later_calls", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo
        .mockImplementationOnce((_params: any, callback: any) => {
          callback(new Error("Rate limit exceeded (Code 29)"), null)
        })
        .mockImplementationOnce((_params: any, callback: any) => {
          callback(null, {
            artist: {
              name: "Rate Band",
              url: "u",
              image: [],
              bio: {},
              tags: { tag: [] },
            },
          })
        })

      const p = getArtistInfo("Rate Band")
      await vi.advanceTimersByTimeAsync(18000)
      const result = await p
      expect(result?.name).toBe("Rate Band")

      const blocked = await getArtistInfo("Another Artist")
      expect(blocked?.name).toBe("Another Artist")
    })

    it("test_getArtistInfo_timeout_retry_then_success", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo
        .mockImplementationOnce((_params: any, callback: any) => {
          const err: any = new Error("timed out")
          err.code = "ETIMEDOUT"
          callback(err, null)
        })
        .mockImplementationOnce((params: any, callback: any) => {
          callback(null, {
            artist: {
              name: params.artist,
              url: "u",
              image: [],
              bio: {},
              tags: { tag: [] },
            },
          })
        })

      const p = getArtistInfo("Timeout Artist")
      await vi.advanceTimersByTimeAsync(2000)
      const result = await p
      expect(result?.name).toBe("Timeout Artist")
    })

    it("test_getArtistInfo_unknown_non_error_value_logs_and_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback("plain string error", null)
      })

      const result = await getArtistInfo("String Error Artist")
      expect(result).toBeNull()
      expect(console.error).toHaveBeenCalled()
    })

    it("test_getArtistInfo_when_no_artist_payload_returns_null_and_caches", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {})
      })

      const first = await getArtistInfo("No Payload Artist")
      const second = await getArtistInfo("no payload artist")
      expect(first).toBeNull()
      expect(second).toBeNull()
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_invalid_key_code_26_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "bad-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Suspended key (Code 26)"), null)
      })

      const result = await getArtistInfo("Suspended Artist")
      expect(result).toBeNull()
    })

    it("test_getArtistInfo_rate_limit_with_retry_exhausted_stays_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Rate limit exceeded (Code 29)"), null)
      })

      const p = getArtistInfo("Rate Exhausted", 1)
      await vi.advanceTimersByTimeAsync(17000)
      const result = await p
      expect(result).toBeNull()
    })

    it("test_getArtistInfo_timeout_retry_exhausted_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        const err: any = new Error("timed out")
        err.name = "AbortError"
        callback(err, null)
      })

      const p = getArtistInfo("Timeout Exhausted", 1)
      await vi.advanceTimersByTimeAsync(2000)
      const result = await p
      expect(result).toBeNull()
    })

    it("test_getArtistInfo_cached_rate_limit_null_retries_after_cooldown", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo
        .mockImplementationOnce((_params: any, callback: any) => {
          callback(new Error("Rate limit exceeded (Code 29)"), null)
        })
        .mockImplementationOnce((params: any, callback: any) => {
          callback(null, {
            artist: {
              name: params.artist,
              url: "u",
              image: [],
              bio: {},
              tags: { tag: [] },
            },
          })
        })

      const first = getArtistInfo("Cooldown Artist")
      await vi.advanceTimersByTimeAsync(17000)
      await first
      await vi.advanceTimersByTimeAsync(70000)
      const secondPromise = getArtistInfo("Cooldown Artist")
      await vi.advanceTimersByTimeAsync(2000)
      const second = await secondPromise
      expect(second?.name).toBe("Cooldown Artist")
    })

    it("test_getArtistInfo_omits_image_uses_empty_array_and_optional_tags", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {
          artist: {
            name: "Bare",
            url: "u",
            bio: {},
          },
        })
      })

      const result = await getArtistInfo("Bare")
      expect(result?.images.large).toBeNull()
      expect(result?.genres).toEqual([])
    })

    it("test_getArtistInfo_image_entries_skip_unknown_size_or_missing_url", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {
          artist: {
            name: "Pick",
            url: "u",
            image: [
              {},
              { size: "bogus", "#text": "https://example.com/odd.jpg" },
              { size: "large", "#text": "https://example.com/l.jpg" },
            ],
            bio: {},
            tags: {},
          },
        })
      })

      const result = await getArtistInfo("Pick")
      expect(result?.images.large).toBe("https://example.com/l.jpg")
    })

    it("test_getArtistInfo_non_array_image_skips_forEach", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {
          artist: {
            name: "Obj Img",
            url: "u",
            image: { size: "large", url: "https://example.com/l.jpg" },
            bio: {},
            tags: { tag: { name: "solo-tag" } },
          },
        })
      })

      const result = await getArtistInfo("Obj Img")
      expect(result?.images.large).toBeNull()
      expect(result?.genres).toEqual([])
    })

    it("test_getArtistInfo_maps_small_medium_from_text_and_url_fallback", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {
          artist: {
            name: "Img Mix",
            url: "u",
            image: [
              { size: "small", url: "https://example.com/s.png" },
              { "#text": "https://example.com/m.png" },
            ],
            bio: {},
            tags: {
              tag: [{ name: "electronic" }, "rock"],
            },
          },
        })
      })

      const result = await getArtistInfo("Img Mix")
      expect(result?.images.small).toBe("https://example.com/s.png")
      expect(result?.images.medium).toBe("https://example.com/m.png")
      expect(result?.genres).toEqual(["electronic", "rock"])
    })

    it("test_getArtistInfo_maps_extralarge_and_mega_images", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(null, {
          artist: {
            name: "Image Artist",
            url: "u",
            image: [
              {
                size: "extralarge",
                "#text": "https://example.com/extralarge.jpg",
              },
              { size: "mega", "#text": "https://example.com/mega.jpg" },
            ],
            bio: {},
            tags: { tag: [] },
          },
        })
      })

      const result = await getArtistInfo("Image Artist")
      expect(result?.images.extralarge).toBe(
        "https://example.com/extralarge.jpg"
      )
      expect(result?.images.mega).toBe("https://example.com/mega.jpg")
    })

    it("test_getArtistInfo_more_than_two_concurrent_requests_queues_until_slot_is_released", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementation((params: any, callback: any) => {
        setTimeout(() => {
          callback(null, {
            artist: {
              name: params.artist,
              url: "u",
              image: [],
              bio: {},
              tags: { tag: [] },
            },
          })
        }, 5000)
      })

      const p1 = getArtistInfo("Queued Artist 1")
      const p2 = getArtistInfo("Queued Artist 2")
      const p3 = getArtistInfo("Queued Artist 3")

      await vi.advanceTimersByTimeAsync(2000)
      expect(mockGetInfo).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(12000)
      const [r1, r2, r3] = await Promise.all([p1, p2, p3])
      expect(r1?.name).toBe("Queued Artist 1")
      expect(r2?.name).toBe("Queued Artist 2")
      expect(r3?.name).toBe("Queued Artist 3")
      expect(mockGetInfo).toHaveBeenCalledTimes(3)
    })

    it("test_getArtistInfo_global_circuit_breaker_logs_once_per_window_and_returns_null", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Rate limit exceeded (Code 29)"), null)
      })

      await getArtistInfo("Global Cooldown Trigger", 1)

      vi.mocked(console.warn).mockClear()
      const blocked1 = await getArtistInfo("Blocked Artist One")
      const warnCallsAfterFirstBlocked = vi.mocked(console.warn).mock.calls
        .length
      const blocked2 = await getArtistInfo("Blocked Artist Two")

      expect(blocked1).toBeNull()
      expect(blocked2).toBeNull()
      expect(warnCallsAfterFirstBlocked).toBe(1)
      expect(vi.mocked(console.warn).mock.calls.length).toBe(1)
      expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain(
        "Last.fm calls paused due to recent rate limiting"
      )
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_cached_rate_limit_error_returns_null_during_cooldown_without_new_call", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")
      const nowSpy = vi.spyOn(Date, "now")
      nowSpy.mockReturnValue(1_000_000)

      mockGetInfo.mockImplementationOnce((_params: any, callback: any) => {
        callback(new Error("Rate limit exceeded (Code 29)"), null)
      })

      const first = await getArtistInfo("Cooldown Cached Artist", 1)

      nowSpy.mockReturnValueOnce(1_060_001).mockReturnValueOnce(1_010_000)
      const second = await getArtistInfo("cooldown cached artist")
      nowSpy.mockRestore()

      expect(first).toBeNull()
      expect(second).toBeNull()
      expect(mockGetInfo).toHaveBeenCalledTimes(1)
    })

    it("test_getArtistInfo_queued_request_returns_null_when_global_cooldown_trips_before_slot_execution", async () => {
      const getArtistInfo = await loadGetArtistInfo()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "test-api-key")

      mockGetInfo
        .mockImplementationOnce((_params: any, callback: any) => {
          setTimeout(() => {
            callback(new Error("Rate limit exceeded (Code 29)"), null)
          }, 10)
        })
        .mockImplementationOnce((params: any, callback: any) => {
          setTimeout(() => {
            callback(null, {
              artist: {
                name: params.artist,
                url: "u",
                image: [],
                bio: {},
                tags: { tag: [] },
              },
            })
          }, 10)
        })

      const p1 = getArtistInfo("Trip Global Cooldown", 1)
      const p2 = getArtistInfo("Second In Flight")
      const p3 = getArtistInfo("Queued While Cooldown Trips")

      await vi.advanceTimersByTimeAsync(2000)
      const queuedResult = await p3
      expect(queuedResult).toBeNull()
      expect(mockGetInfo).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(3000)
      await Promise.all([p1, p2])
    })
  })

  describe("searchLastFmArtists", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "error").mockImplementation(() => {})
      vi.unstubAllEnvs()
      mockSearch.mockReset()
      mockSearch.mockImplementation(
        (
          params: { artist: string; limit: number },
          callback: (err: unknown, res: unknown) => void
        ) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: [{ name: params.artist, listeners: "1000" }],
              },
            },
          })
        }
      )
      vi.useRealTimers()
    })

    afterEach(() => {
      vi.mocked(console.warn).mockRestore()
      vi.mocked(console.error).mockRestore()
      vi.unstubAllEnvs()
    })

    it("test_searchLastFmArtists_when_feature_disabled_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "false")
      vi.stubEnv("LASTFM_API_KEY", "key")

      await expect(searchLastFmArtists("radio", 10)).resolves.toEqual([])
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it("test_searchLastFmArtists_when_api_key_missing_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      delete process.env.LASTFM_API_KEY
      delete process.env.LASTFM_SECRET

      await expect(searchLastFmArtists("radio", 10)).resolves.toEqual([])
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it("test_searchLastFmArtists_blank_query_or_non_positive_limit_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      await expect(searchLastFmArtists("   ", 5)).resolves.toEqual([])
      await expect(searchLastFmArtists("x", 0)).resolves.toEqual([])
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it("test_searchLastFmArtists_maps_array_hits_and_clamps_limit", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: [
                  { name: "Alpha", listeners: "12" },
                  { name: "Beta", listeners: 34 },
                  { name: "Gamma", listeners: "nope" },
                  null,
                  { name: 123 },
                ],
              },
            },
          })
        }
      )

      const hits = await searchLastFmArtists("ab", 99)
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({ artist: "ab", limit: 30 }),
        expect.any(Function)
      )
      expect(hits).toEqual([
        { name: "Alpha", listeners: 12 },
        { name: "Beta", listeners: 34 },
        { name: "Gamma", listeners: undefined },
      ])
    })

    it("test_searchLastFmArtists_single_artist_object_normalizes_to_array", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: { name: "Solo", listeners: "500" },
              },
            },
          })
        }
      )

      await expect(searchLastFmArtists("so", 5)).resolves.toEqual([
        { name: "Solo", listeners: 500 },
      ])
    })

    it("test_searchLastFmArtists_missing_matches_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, {})
        }
      )

      await expect(searchLastFmArtists("q", 5)).resolves.toEqual([])
    })

    it("test_searchLastFmArtists_uses_secret_constructor_when_set", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")
      vi.stubEnv("LASTFM_SECRET", "sec")
      vi.mocked(LastFMArtist).mockClear()

      await searchLastFmArtists("z", 3)
      expect(vi.mocked(LastFMArtist)).toHaveBeenCalledWith("key", "sec")
    })

    it("test_searchLastFmArtists_rate_limit_error_sets_global_cooldown_and_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(new Error("Rate limit exceeded (Code 29)"), null)
        }
      )

      await expect(searchLastFmArtists("rl", 5)).resolves.toEqual([])

      await expect(searchLastFmArtists("rl2", 5)).resolves.toEqual([])
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })

    it("test_searchLastFmArtists_not_found_error_does_not_console_error", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(new Error("Artist not found (Code 6)"), null)
        }
      )

      await searchLastFmArtists("missing", 5)
      expect(console.error).not.toHaveBeenCalled()
    })

    it("test_searchLastFmArtists_other_error_logs_and_returns_empty", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(new Error("network down"), null)
        }
      )

      await searchLastFmArtists("x", 5)
      expect(console.error).toHaveBeenCalled()
    })

    it("test_searchLastFmArtists_null_response_resolves_to_empty_hits", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, null)
        }
      )

      await expect(searchLastFmArtists("nil", 5)).resolves.toEqual([])
    })

    it("test_searchLastFmArtists_rate_limit_message_without_code_sets_cooldown", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(new Error("Sorry, rate limit"), null)
        }
      )

      await expect(searchLastFmArtists("rlmsg", 5)).resolves.toEqual([])
      await expect(searchLastFmArtists("rlmsg2", 5)).resolves.toEqual([])
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })

    it("test_searchLastFmArtists_numeric_listeners_only", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: [{ name: "Num", listeners: 42 }],
              },
            },
          })
        }
      )

      await expect(searchLastFmArtists("num", 5)).resolves.toEqual([
        { name: "Num", listeners: 42 },
      ])
    })

    it("test_searchLastFmArtists_non_numeric_non_string_listeners_omitted", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch.mockImplementationOnce(
        (_params: { artist: string; limit: number }, callback: any) => {
          callback(null, {
            results: {
              artistmatches: {
                artist: [{ name: "Weird", listeners: null }],
              },
            },
          })
        }
      )

      await expect(searchLastFmArtists("weird", 5)).resolves.toEqual([
        { name: "Weird", listeners: undefined },
      ])
    })

    it("test_searchLastFmArtists_queued_call_sees_global_cooldown_after_slot_acquire", async () => {
      const searchLastFmArtists = await loadSearchLastFmArtists()
      vi.useFakeTimers()
      vi.stubEnv("ENABLE_LASTFM", "true")
      vi.stubEnv("LASTFM_API_KEY", "key")

      mockSearch
        .mockImplementationOnce(
          (_params: { artist: string; limit: number }, callback: any) => {
            setTimeout(
              () => callback(new Error("Rate limit exceeded (Code 29)"), null),
              30
            )
          }
        )
        .mockImplementationOnce(
          (params: { artist: string; limit: number }, callback: any) => {
            setTimeout(
              () =>
                callback(null, {
                  results: {
                    artistmatches: {
                      artist: [{ name: params.artist, listeners: "1" }],
                    },
                  },
                }),
              5000
            )
          }
        )

      const pFirst = searchLastFmArtists("first", 5)
      const pSecond = searchLastFmArtists("second", 5)
      const pQueued = searchLastFmArtists("queued", 5)

      await vi.advanceTimersByTimeAsync(50)
      const queuedResult = await pQueued
      expect(queuedResult).toEqual([])

      await vi.runAllTimersAsync()
      await Promise.all([pFirst, pSecond])

      expect(mockSearch).toHaveBeenCalledTimes(2)
    })
  })

  describe("pickPreferredLastFmArtistImageUrl", () => {
    it("returns null when data is null", async () => {
      const { pickPreferredLastFmArtistImageUrl } = await import("../lastfm")
      expect(pickPreferredLastFmArtistImageUrl(null)).toBeNull()
    })

    it("prefers larger sizes", async () => {
      const { pickPreferredLastFmArtistImageUrl } = await import("../lastfm")
      const base = {
        name: "Artist",
        url: "https://last.fm/music/Artist",
        genres: [] as string[],
        bio: null as string | null,
      }
      expect(
        pickPreferredLastFmArtistImageUrl({
          ...base,
          images: {
            small: "a",
            medium: "b",
            large: "c",
            extralarge: null,
            mega: null,
          },
        })
      ).toBe("c")
      expect(
        pickPreferredLastFmArtistImageUrl({
          ...base,
          images: {
            small: "a",
            medium: null,
            large: null,
            extralarge: "d",
            mega: null,
          },
        })
      ).toBe("d")
    })
  })
})
