/**
 * Tests for SimilarGroup component.
 *
 * Verifies group description rendering, member thumbnails,
 * best photo highlight, and current photo highlight.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SimilarGroup } from "./SimilarGroup";
import type { Photo } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockOpenDetail = vi.fn();
let mockPhotos: Photo[] = [];

vi.mock("../store", () => ({
  usePhotoStore: (selector?: any) => {
    const state = {
      photos: mockPhotos,
      openDetail: mockOpenDetail,
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
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SimilarGroup", () => {
  it("renders null when photo has no group", () => {
    const { container } = render(
      <SimilarGroup photo={makePhoto({ group: null })} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders the group description", () => {
    const photo = makePhoto({
      id: 1,
      group: {
        groupId: 5,
        desc: "几乎相同的构图，曝光不同",
        groupSize: 3,
        index: 0,
        isHighest: true,
      },
    });
    mockPhotos = [
      photo,
      makePhoto({
        id: 2,
        group: { groupId: 5, desc: "几乎相同的构图，曝光不同", groupSize: 3, index: 1 },
      }),
      makePhoto({
        id: 3,
        group: { groupId: 5, desc: "几乎相同的构图，曝光不同", groupSize: 3, index: 2 },
      }),
    ];

    render(<SimilarGroup photo={photo} />);
    expect(screen.getByText("几乎相同的构图，曝光不同")).toBeInTheDocument();
  });

  it("renders fallback description when group has no desc", () => {
    const photo = makePhoto({
      id: 1,
      group: { groupId: 5, desc: "", groupSize: 1, index: 0 },
    });
    mockPhotos = [photo];

    render(<SimilarGroup photo={photo} />);
    expect(screen.getByText("相似组 #5")).toBeInTheDocument();
  });

  it("shows member count", () => {
    const photo = makePhoto({
      id: 1,
      group: {
        groupId: 5,
        desc: "相似曝光组",
        groupSize: 3,
        index: 0,
        isHighest: true,
      },
    });
    mockPhotos = [
      photo,
      makePhoto({
        id: 2,
        group: { groupId: 5, desc: "相似曝光组", groupSize: 3, index: 1 },
      }),
      makePhoto({
        id: 3,
        group: { groupId: 5, desc: "相似曝光组", groupSize: 3, index: 2 },
      }),
    ];

    render(<SimilarGroup photo={photo} />);

    // The component shows "{groupMembers.length} 张" in the header
    expect(screen.getByText("3 张")).toBeInTheDocument();
  });

  it("shows member thumbnails for each group member", () => {
    const photo = makePhoto({
      id: 1,
      group: {
        groupId: 5,
        desc: "组",
        groupSize: 2,
        index: 0,
        isHighest: false,
      },
    });
    mockPhotos = [
      photo,
      makePhoto({
        id: 2,
        filepath: "/photos/other.nef",
        group: { groupId: 5, desc: "组", groupSize: 2, index: 1, isHighest: true },
      }),
    ];

    render(<SimilarGroup photo={photo} />);

    // Each member is rendered as a button (role="button")
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("highlights the best photo with a star icon", () => {
    const photo = makePhoto({
      id: 1,
      group: {
        groupId: 5,
        desc: "组",
        groupSize: 2,
        index: 0,
        isHighest: false,
      },
    });
    mockPhotos = [
      photo,
      makePhoto({
        id: 2,
        filepath: "/photos/best.nef",
        group: { groupId: 5, desc: "组", groupSize: 2, index: 1, isHighest: true },
      }),
    ];

    render(<SimilarGroup photo={photo} />);

    // The best photo gets a Star icon (lucide-star)
    expect(document.querySelector(".lucide-star")).toBeInTheDocument();
  });

  it("calls openDetail when a member thumbnail is clicked", () => {
    const photo = makePhoto({
      id: 1,
      group: {
        groupId: 5,
        desc: "组",
        groupSize: 2,
        index: 0,
        isHighest: false,
      },
    });
    mockPhotos = [
      photo,
      makePhoto({
        id: 2,
        filepath: "/photos/member.nef",
        group: { groupId: 5, desc: "组", groupSize: 2, index: 1, isHighest: true },
      }),
    ];

    render(<SimilarGroup photo={photo} />);

    const buttons = screen.getAllByRole("button");
    // Members are sorted by isHighest descending, so buttons[0] is best (id=2)
    // buttons[1] is the current photo (id=1)
    fireEvent.click(buttons[0]);
    expect(mockOpenDetail).toHaveBeenCalledWith(2);
  });
});
