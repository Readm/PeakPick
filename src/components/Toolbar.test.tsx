/**
 * Tests for Toolbar component.
 *
 * Verifies select-all, Pick Top 9, delete low-score buttons are rendered,
 * and batch action buttons are disabled when nothing is selected.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Toolbar } from "./Toolbar";
import type { Photo } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSelectAll = vi.fn();
const mockClearSelection = vi.fn();
const mockBatchDismiss = vi.fn();
const mockBatchKeep = vi.fn();
const mockBatchToggleLock = vi.fn();
const mockSelectTop9 = vi.fn();
const mockBatchDeleteLow = vi.fn();
let mockPhotos: Photo[] = [];

vi.mock("../store", () => ({
  usePhotoStore: (selector?: any) => {
    const state = {
      photos: mockPhotos,
      selectAll: mockSelectAll,
      clearSelection: mockClearSelection,
      batchDismiss: mockBatchDismiss,
      batchKeep: mockBatchKeep,
      batchToggleLock: mockBatchToggleLock,
      selectTop9: mockSelectTop9,
      batchDeleteLow: mockBatchDeleteLow,
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

describe("Toolbar", () => {
  it("renders the select all button", () => {
    mockPhotos = [makePhoto({ id: 1 }), makePhoto({ id: 2 })];
    render(<Toolbar />);
    expect(screen.getByText("全选")).toBeInTheDocument();
  });

  it("renders the Pick Top 9 button", () => {
    render(<Toolbar />);
    expect(screen.getByText("一键选9图")).toBeInTheDocument();
  });

  it("renders the delete low score button", () => {
    render(<Toolbar />);
    expect(screen.getByText("删除低于阈值")).toBeInTheDocument();
  });

  it("shows '全选' when not all photos are selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: true }),
      makePhoto({ id: 2, selected: false }),
    ];
    render(<Toolbar />);
    expect(screen.getByText("全选")).toBeInTheDocument();
  });

  it("shows '取消全选' when all photos are selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: true }),
      makePhoto({ id: 2, selected: true }),
    ];
    render(<Toolbar />);
    expect(screen.getByText("取消全选")).toBeInTheDocument();
  });

  it("calls selectAll when '全选' is clicked", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: false }),
      makePhoto({ id: 2, selected: false }),
    ];
    render(<Toolbar />);
    fireEvent.click(screen.getByText("全选"));
    expect(mockSelectAll).toHaveBeenCalledOnce();
  });

  it("calls clearSelection when '取消全选' is clicked", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: true }),
      makePhoto({ id: 2, selected: true }),
    ];
    render(<Toolbar />);
    fireEvent.click(screen.getByText("取消全选"));
    expect(mockClearSelection).toHaveBeenCalledOnce();
  });

  it("calls selectTop9 when the Pick Top 9 button is clicked", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("一键选9图"));
    expect(mockSelectTop9).toHaveBeenCalledOnce();
  });

  it("calls batchDeleteLow when the delete button is clicked", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText("删除低于阈值"));
    expect(mockBatchDeleteLow).toHaveBeenCalledOnce();
  });

  it("disables batch action buttons when nothing is selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: false }),
      makePhoto({ id: 2, selected: false }),
    ];
    render(<Toolbar />);

    // Batch buttons: 忽略选中, 保留选中, 锁定选中
    const dismissBtn = screen.getByText("忽略选中");
    const keepBtn = screen.getByText("保留选中");
    const lockBtn = screen.getByText("锁定选中");

    expect(dismissBtn).toBeDisabled();
    expect(keepBtn).toBeDisabled();
    expect(lockBtn).toBeDisabled();
  });

  it("enables batch action buttons when photos are selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: true }),
      makePhoto({ id: 2, selected: false }),
    ];
    render(<Toolbar />);

    const dismissBtn = screen.getByText("忽略选中");
    const keepBtn = screen.getByText("保留选中");
    const lockBtn = screen.getByText("锁定选中");

    expect(dismissBtn).not.toBeDisabled();
    expect(keepBtn).not.toBeDisabled();
    expect(lockBtn).not.toBeDisabled();
  });

  it("shows selected count when photos are selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: true }),
      makePhoto({ id: 2, selected: true }),
      makePhoto({ id: 3, selected: false }),
    ];
    render(<Toolbar />);
    expect(screen.getByText("已选 2 张")).toBeInTheDocument();
  });

  it("does not show selected count when nothing is selected", () => {
    mockPhotos = [
      makePhoto({ id: 1, selected: false }),
      makePhoto({ id: 2, selected: false }),
    ];
    render(<Toolbar />);
    expect(screen.queryByText(/已选/)).not.toBeInTheDocument();
  });

  it("renders stats with total and dismissed counts", () => {
    mockPhotos = [
      makePhoto({ id: 1, score: 3.0, status: "pending", locked: false }),
      makePhoto({ id: 2, score: 4.0, status: "dismissed", locked: false }),
      makePhoto({ id: 3, score: 5.0, status: "kept", locked: true }),
    ];
    render(<Toolbar />);

    // Stats section shows totals: total=3, active=1, dismissed=1, locked=1
    // "3" is unique (total) — appears once
    expect(screen.getByText("3")).toBeInTheDocument();
    // "1" appears multiple times (active, dismissed, locked)
    const ones = screen.getAllByText("1");
    expect(ones.length).toBeGreaterThanOrEqual(3);
  });
});
