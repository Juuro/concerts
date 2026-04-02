import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Hoisted with the mock factory so the factory does not close over a TDZ-bound const.
const { mockGetInfo } = vi.hoisted(() => {
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
  return { mockGetInfo }
})

// Vitest 4+ requires a real `function` (or class) when code uses `new` on the mock.
vi.mock("lastfm-ts-api", () => ({
  LastFMArtist: vi.fn(function LastFMArtist(_apiKey: string, _secret?: string) {
    return { getInfo: mockGetInfo }
  }),
}))

async function loadGetArtistInfo() {
  vi.resetModules()
  const mod = await import("../lastfm")
  return mod.getArtistInfo
}

describe("lastfm", () => {
  describe("getArtistInfo", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.spyOn(console, "error").mockImplementation(() => {})
      vi.unstubAllEnvs()
      mockGetInfo.mockReset()
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

    it("test_getArtistInfo_rate_limit_triggers_retry_and_global_cooldown", async () => {
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
      expect(result).toBeNull()

      const blocked = await getArtistInfo("Another Artist")
      expect(blocked).toBeNull()
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
  })
})
