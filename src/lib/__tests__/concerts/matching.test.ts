import { describe, expect, test } from "vitest"
import {
  getHeadlinerBandIdsInOrder,
  getPrimaryHeadlinerBandId,
  headlinerOrdersEqual,
  headlinerSetsEqual,
} from "@/lib/concerts/matching"

describe("matching headliner helpers", () => {
  test("getHeadlinerBandIdsInOrder preserves form order", () => {
    expect(
      getHeadlinerBandIdsInOrder([
        { bandId: "b", isHeadliner: false },
        { bandId: "a", isHeadliner: true },
        { bandId: "c", isHeadliner: true },
      ])
    ).toEqual(["a", "c"])
  })

  test("getPrimaryHeadlinerBandId is first headliner in order", () => {
    expect(
      getPrimaryHeadlinerBandId([
        { bandId: "second", isHeadliner: true },
        { bandId: "first", isHeadliner: true },
      ])
    ).toBe("second")
  })

  test("headlinerSetsEqual ignores order", () => {
    expect(headlinerSetsEqual(["a", "b"], ["b", "a"])).toBe(true)
    expect(headlinerSetsEqual(["a"], ["a", "b"])).toBe(false)
  })

  test("headlinerOrdersEqual requires same order", () => {
    expect(headlinerOrdersEqual(["a", "b"], ["a", "b"])).toBe(true)
    expect(headlinerOrdersEqual(["a", "b"], ["b", "a"])).toBe(false)
    expect(headlinerOrdersEqual(["a"], ["a", "b"])).toBe(false)
  })
})
