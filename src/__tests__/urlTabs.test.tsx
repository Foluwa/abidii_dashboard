import React from "react";
import { render, screen } from "@testing-library/react";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";

const mockReplace = jest.fn();
let mockSearchParams: URLSearchParams;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  usePathname: () => "/system/health",
  useSearchParams: () => mockSearchParams,
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href, scroll, ...rest }: any) {
    void scroll;
    return (
      <a href={typeof href === "string" ? href : href.pathname ?? "#"} {...rest}>
        {children}
      </a>
    );
  };
});

describe("UrlTabs permission / retained-panel behaviour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
  });

  it("never mounts or renders a directly-accessed restricted tab", () => {
    mockSearchParams = new URLSearchParams("tab=secret");
    const renderTab = jest.fn((key: string) => <div data-testid={`panel-${key}`}>{key}</div>);
    const tabs: UrlTab[] = [
      { key: "a", label: "A" },
      { key: "secret", label: "Secret", allowed: false },
    ];

    render(<UrlTabs tabs={tabs} defaultKey="a" renderTab={renderTab} />);

    expect(screen.getByText(/permission/i)).toBeInTheDocument();
    // No tab content was ever mounted, so renderTab is never called.
    expect(renderTab).not.toHaveBeenCalled();
    expect(screen.queryByTestId("panel-secret")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-a")).not.toBeInTheDocument();
  });

  it("keeps a visited allowed tab mounted (hidden) and drops it on revocation", () => {
    mockSearchParams = new URLSearchParams("tab=a");
    const renderTab = jest.fn((key: string) => <div data-testid={`panel-${key}`}>{key}</div>);
    const allowedTabs: UrlTab[] = [
      { key: "a", label: "A" },
      { key: "secret", label: "Secret" },
    ];

    const { rerender } = render(<UrlTabs tabs={allowedTabs} defaultKey="a" renderTab={renderTab} />);
    expect(screen.getByTestId("panel-a")).toBeInTheDocument();

    // Visit "secret" (becomes active) — it is now mounted + retained.
    mockSearchParams = new URLSearchParams("tab=secret");
    rerender(<UrlTabs tabs={allowedTabs} defaultKey="a" renderTab={renderTab} />);
    expect(screen.getByTestId("panel-secret")).toBeInTheDocument();

    // Switch back to "a": "secret" stays mounted (hidden, state retained).
    mockSearchParams = new URLSearchParams("tab=a");
    rerender(<UrlTabs tabs={allowedTabs} defaultKey="a" renderTab={renderTab} />);
    const secretPanel = screen.getByTestId("panel-secret");
    expect(secretPanel).toBeInTheDocument();
    expect(secretPanel.closest('[role="tabpanel"]')?.hasAttribute("hidden")).toBe(true);

    // Revoke access to "secret" while it is retained: it must be unmounted.
    const revokedTabs: UrlTab[] = [
      { key: "a", label: "A" },
      { key: "secret", label: "Secret", allowed: false },
    ];
    rerender(<UrlTabs tabs={revokedTabs} defaultKey="a" renderTab={renderTab} />);
    expect(screen.queryByTestId("panel-secret")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-a")).toBeInTheDocument();
  });

  it("strips an unknown tab value via router.replace (no mount)", () => {
    mockSearchParams = new URLSearchParams("tab=bogus");
    const renderTab = jest.fn((key: string) => <div data-testid={`panel-${key}`}>{key}</div>);
    const tabs: UrlTab[] = [{ key: "a", label: "A" }];

    render(<UrlTabs tabs={tabs} defaultKey="a" renderTab={renderTab} />);

    // Falls back to the default tab and replaces the URL to drop "bogus".
    expect(mockReplace).toHaveBeenCalledWith("/system/health", expect.anything());
    expect(renderTab).toHaveBeenCalledWith("a", true);
  });
});
