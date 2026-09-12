import React from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import UserRetentionCard from "@/components/analytics/UserRetentionCard";
import { renderWithProviders as render } from "@/test-utils";
import type { RetentionResponse } from "@/types/admin-analytics";

// react-apexcharts needs a real browser canvas/SVG environment it doesn't
// get in jsdom - stub out the next/dynamic import UserRetentionCard uses
// for it, same idea as other Next.js mocks in jest.setup.ts.
jest.mock("next/dynamic", () => () => {
  function MockChart() {
    return <div data-testid="mock-apex-chart" />;
  }
  return MockChart;
});

jest.mock("@/lib/api", () => ({
  apiClient: { get: jest.fn() },
}));

const mockRefresh = jest.fn();
const mockUseUserRetention = jest.fn();

jest.mock("@/hooks/useApi", () => ({
  useUserRetention: (...args: unknown[]) => mockUseUserRetention(...args),
}));

const successData: RetentionResponse = {
  generated_at: "2026-09-12T00:00:00Z",
  timezone: "UTC",
  retention: {
    day_1: { rate: 42.0, retained_users: 21, eligible_users: 50 },
    day_7: { rate: 25.0, retained_users: 17, eligible_users: 68 },
    day_30: { rate: null, retained_users: 0, eligible_users: 0 },
  },
  weekly_returning_users: [
    { week_start: "2026-08-10", week_end: "2026-08-16", returning_users: 12, active_users: 20 },
    { week_start: "2026-08-17", week_end: "2026-08-23", returning_users: 18, active_users: 29 },
  ],
  monthly_summary: {
    period_label: "Month to date",
    returning_users: 18,
    eligible_users: 67,
    previous_comparable_returning_users: 14,
    absolute_change: 4,
  },
};

function setHookState(overrides: {
  data?: typeof successData;
  isLoading?: boolean;
  isError?: unknown;
}) {
  mockUseUserRetention.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refresh: mockRefresh,
    ...overrides,
  });
}

describe("UserRetentionCard", () => {
  beforeEach(() => {
    mockRefresh.mockClear();
    mockUseUserRetention.mockClear();
  });

  it("shows loading skeletons while data is loading, with stable card structure", () => {
    setHookState({ isLoading: true });
    render(<UserRetentionCard />);

    expect(screen.getByText("User Retention")).toBeInTheDocument();
    expect(screen.getByLabelText("Loading user retention data")).toBeInTheDocument();
  });

  it("formats KPI percentages without a trailing .0", () => {
    setHookState({ data: successData });
    render(<UserRetentionCard />);

    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("shows a dash and 'not enough data' for an unavailable KPI (Day 30) while others remain available", () => {
    setHookState({ data: successData });
    render(<UserRetentionCard />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("Not enough data")).toBeInTheDocument();
    // Day 1/7 remain fully available alongside the unavailable Day 30.
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("shows the insufficient-data message when every KPI is unavailable", () => {
    setHookState({
      data: {
        ...successData,
        retention: {
          day_1: { rate: null, retained_users: 0, eligible_users: 0 },
          day_7: { rate: null, retained_users: 0, eligible_users: 0 },
          day_30: { rate: null, retained_users: 0, eligible_users: 0 },
        },
      },
    });
    render(<UserRetentionCard />);

    expect(
      screen.getByText("Not enough user history to calculate this metric")
    ).toBeInTheDocument();
  });

  it("renders a positive monthly change in green with an up arrow", () => {
    setHookState({ data: successData });
    render(<UserRetentionCard />);

    expect(screen.getByText(/18 of 67 users returned this month/)).toBeInTheDocument();
    const changeSpan = screen.getByText(/vs last month/);
    expect(changeSpan.className).toContain("text-green-600");
    expect(changeSpan.textContent).toContain("↑");
  });

  it("renders a negative monthly change in red with a down arrow", () => {
    setHookState({
      data: {
        ...successData,
        monthly_summary: { ...successData.monthly_summary, returning_users: 10, absolute_change: -4 },
      },
    });
    render(<UserRetentionCard />);

    const changeSpan = screen.getByText(/vs last month/);
    expect(changeSpan.className).toContain("text-red-600");
    expect(changeSpan.textContent).toContain("↓");
  });

  it("renders an unchanged month in muted text, not colored", () => {
    setHookState({
      data: {
        ...successData,
        monthly_summary: { ...successData.monthly_summary, absolute_change: 0 },
      },
    });
    render(<UserRetentionCard />);

    const changeSpan = screen.getByText(/vs last month/);
    expect(changeSpan.className).toContain("text-gray-500");
    expect(changeSpan.className).not.toContain("text-green-600");
    expect(changeSpan.className).not.toContain("text-red-600");
  });

  it("shows a compact error message with a retry action on API failure, without breaking the card", async () => {
    setHookState({ isError: { message: "Network Error" } });
    render(<UserRetentionCard />);

    expect(screen.getByText("User Retention")).toBeInTheDocument();
    expect(screen.getByText(/Failed to load user retention/)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: "Retry" });
    await userEvent.click(retryButton);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("calls refresh when the header Refresh button is clicked", async () => {
    setHookState({ data: successData });
    render(<UserRetentionCard />);

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("includes a hidden accessible tabular summary of the weekly chart values", () => {
    setHookState({ data: successData });
    render(<UserRetentionCard />);

    expect(screen.getByText("Returning users by week")).toBeInTheDocument();
  });
});
