/**
 * Tests for PhotoCard component.
 *
 * Verifies filename rendering, score cycling, selection toggling,
 * dismissed overlay, and lock icon display.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PhotoCard } from "./PhotoCard";
import type { Photo } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockToggleSelect = vi.fn();
const mockToggleLock = vi.fn();
const mockUpdateScore = vi.fn();

vi.mock("../store", () => ({
  usePhotoStore: (selector?: any) => {
    const state = {
      toggleSelect: mockToggleSelect,
      toggleLock: mockToggleLock,
      updateScore: mockUpdateScore,
    };
    return selector ? selector(state) : state;
  },
}));

// By default, mock fetchThumbnail to return an error so the placeholder text
// (filename) is shown instead of an <img>.
vi.mock("../api", () => ({
  fetchThumbnail: vi.fn().mockResolvedValue({ error: "mock no thumbnail" }),
}));

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1,
    filename: "DSC_00123.NEF",
    filepath: "/photos/DSC_00123.NEF",
    score: 3.8,
    status: "pending",
    locked: false,
    selected: false,
    group: null,
    date: "2026-03-15",
    dateObj: new Date("2026-03-15"),
    width: 6000,
    height: 4000,
    fileSize: 24_300_000,
    ...overrides,
  };
}

const onOpen = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PhotoCard", () => {
  it("renders the filename when thumbnail is unavailable", () => {
    render(<PhotoCard photo={makePhoto()} onOpen={onOpen} />);
    expect(screen.getByText("DSC_00123.NEF")).toBeInTheDocument();
  });

  it("calls updateScore when the score label overlay is clicked", () => {
    render(<PhotoCard photo={makePhoto({ score: 3.8 })} onOpen={onOpen} />);

    // formatScore(3.8) → "4-" (since 3.8 <= 3.833 threshold)
    const scoreBadge = screen.getByText("4-");
    expect(scoreBadge).toBeInTheDocument();

    fireEvent.click(scoreBadge);
    expect(mockUpdateScore).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it("toggles selection when the checkbox area is clicked", () => {
    const { container } = render(
      <PhotoCard photo={makePhoto()} onOpen={onOpen} />
    );

    // The checkbox is an absolutely-positioned div in the top-left corner.
    // It has classes "absolute top-1.5 left-1.5" — use class-contains selector.
    const checkbox = container.querySelector('[class*="top-1"][class*="left-1"]');
    expect(checkbox).toBeInTheDocument();
    fireEvent.click(checkbox!);
    expect(mockToggleSelect).toHaveBeenCalledWith(1);
  });

  it("shows dismissed overlay text when photo status is dismissed", () => {
    render(
      <PhotoCard photo={makePhoto({ status: "dismissed" })} onOpen={onOpen} />
    );
    expect(screen.getByText("已忽略")).toBeInTheDocument();
  });

  it("shows lock icon when photo is locked", () => {
    const { container } = render(
      <PhotoCard photo={makePhoto({ locked: true })} onOpen={onOpen} />
    );

    // Lock icon from lucide-react renders <svg class="lucide lucide-lock" …>
    expect(container.querySelector(".lucide-lock")).toBeInTheDocument();
    expect(container.querySelector(".lucide-unlock")).not.toBeInTheDocument();
  });

  it("shows unlock icon when photo is not locked", () => {
    const { container } = render(
      <PhotoCard photo={makePhoto({ locked: false })} onOpen={onOpen} />
    );

    // Lock icon should NOT be rendered
    expect(container.querySelector(".lucide-lock")).not.toBeInTheDocument();
    // The lock toggle area (top-right) should contain an SVG (the unlock icon)
    const lockArea = container.querySelector(
      '[class*="top-1"][class*="right-1"]'
    );
    expect(lockArea).toBeInTheDocument();
    expect(lockArea?.querySelector("svg")).toBeInTheDocument();
  });
});
