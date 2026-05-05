/**
 * Tests for ScoreDistribution component.
 *
 * Verifies that 5 bars (labels 1–5) are rendered with correct counts,
 * and that clicking a bar updates the filter.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ScoreDistribution } from "./ScoreDistribution";
import type { Photo, FilterState } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSetFilter = vi.fn();
let mockPhotos: Photo[] = [];
let mockFilter: FilterState = {
  mode: "pending",
  scoreThreshold: 1,
  showingDismissed: false,
  showingLocked: false,
  searchQuery: "",
};

vi.mock("../store", () => ({
  usePhotoStore: (selector?: any) => {
    const state = {
      photos: mockPhotos,
      filter: mockFilter,
      setFilter: mockSetFilter,
    };
    return selector ? selector(state) : state;
  },
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    filename: "photo.nef",
    filepath: "/photos/photo.nef",
    score: 3.0,
    status: "pending",
    locked: false,
    selected: false,
    group: null,
    date: "2026-03-15",
    dateObj: new Date("2026-03-15"),
    width: 6000,
    height: 4000,
    fileSize: 10_000_000,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPhotos = [];
  mockFilter = {
    mode: "pending",
    scoreThreshold: 1,
    showingDismissed: false,
    showingLocked: false,
    searchQuery: "",
  };
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ScoreDistribution", () => {
  it("renders 5 bars (button elements) with labels 1 through 5", () => {
    // Provide at least one photo per bucket so all 5 bars show a count
    mockPhotos = [
      makePhoto({ id: 1, score: 1.0 }),
      makePhoto({ id: 2, score: 2.0 }),
      makePhoto({ id: 3, score: 3.0 }),
      makePhoto({ id: 4, score: 4.0 }),
      makePhoto({ id: 5, score: 5.0 }),
    ];

    render(<ScoreDistribution />);

    // Exactly 5 bar buttons should be rendered
    const bars = screen.getAllByRole("button");
    expect(bars).toHaveLength(5);

    // Each button contains a <span> with the base number as text content
    expect(bars[0]).toHaveTextContent("1");
    expect(bars[1]).toHaveTextContent("2");
    expect(bars[2]).toHaveTextContent("3");
    expect(bars[3]).toHaveTextContent("4");
    expect(bars[4]).toHaveTextContent("5");
  });

  it("displays the correct count per bar", () => {
    // 2 photos in bucket 1, 3 photos in bucket 3, 0 in others
    mockPhotos = [
      makePhoto({ id: 1, score: 1.0 }), // → label "1", base 1
      makePhoto({ id: 2, score: 1.0 }), // → label "1", base 1
      makePhoto({ id: 3, score: 3.0 }), // → label "3", base 3
      makePhoto({ id: 4, score: 3.0 }), // → label "3", base 3
      makePhoto({ id: 5, score: 3.0 }), // → label "3", base 3
    ];

    render(<ScoreDistribution />);

    const bars = screen.getAllByRole("button");

    // Bucket 1 has count 2
    expect(bars[0]).toHaveTextContent("2");
    // Bucket 2 has count 0
    expect(bars[1]).toHaveTextContent("0");
    // Bucket 3 has count 3
    expect(bars[2]).toHaveTextContent("3");
    // Bucket 4 has count 0
    expect(bars[3]).toHaveTextContent("0");
    // Bucket 5 has count 0
    expect(bars[4]).toHaveTextContent("0");
  });

  it("calls setFilter with the correct base when a bar is clicked", () => {
    mockPhotos = [
      makePhoto({ id: 1, score: 3.0 }),
      makePhoto({ id: 2, score: 4.5 }),
    ];

    render(<ScoreDistribution />);

    const bars = screen.getAllByRole("button");

    // Click bar for base 3 (third bar, index 2)
    fireEvent.click(bars[2]);
    expect(mockSetFilter).toHaveBeenCalledWith({ scoreThreshold: 3 });

    // Click bar for base 5 (fifth bar, index 4)
    fireEvent.click(bars[4]);
    expect(mockSetFilter).toHaveBeenCalledWith({ scoreThreshold: 5 });
  });
});
