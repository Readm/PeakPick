/**
 * Tests for FilterBar component.
 *
 * Verifies search input, filter chips (全部, 待处理, 保留, 已忽略),
 * and threshold slider are rendered.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FilterBar } from "./FilterBar";
import type { FilterState } from "../types";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockSetFilter = vi.fn();
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
      filter: mockFilter,
      setFilter: mockSetFilter,
    };
    return selector ? selector(state) : state;
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockFilter = {
    mode: "pending",
    scoreThreshold: 1,
    showingDismissed: false,
    showingLocked: false,
    searchQuery: "",
  };
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("FilterBar", () => {
  it("renders the search input with placeholder", () => {
    render(<FilterBar />);
    const input = screen.getByPlaceholderText("文件名搜索");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders all filter chips", () => {
    render(<FilterBar />);

    expect(screen.getByText("全部")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
    expect(screen.getByText("保留")).toBeInTheDocument();
    expect(screen.getByText("已忽略")).toBeInTheDocument();
  });

  it("renders the threshold slider with correct range", () => {
    render(<FilterBar />);

    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "5");
  });

  it("shows the threshold value label", () => {
    // scoreThreshold=1 → formatScore(1) → "1"
    render(<FilterBar />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("calls setFilter when search input changes", () => {
    render(<FilterBar />);
    const input = screen.getByPlaceholderText("文件名搜索");
    fireEvent.change(input, { target: { value: "DSC_" } });
    expect(mockSetFilter).toHaveBeenCalledWith({ searchQuery: "DSC_" });
  });

  it("calls setFilter when a filter chip is clicked", () => {
    render(<FilterBar />);

    // Click "保留" chip (mode "kept")
    fireEvent.click(screen.getByText("保留"));
    expect(mockSetFilter).toHaveBeenCalledWith({ mode: "kept" });

    // Click "已忽略" chip (toggles showingDismissed)
    fireEvent.click(screen.getByText("已忽略"));
    expect(mockSetFilter).toHaveBeenCalledWith({ showingDismissed: true });
  });

  it("calls setFilter when threshold slider changes", () => {
    render(<FilterBar />);

    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "3" } });
    expect(mockSetFilter).toHaveBeenCalledWith({ scoreThreshold: 3 });
  });
});
