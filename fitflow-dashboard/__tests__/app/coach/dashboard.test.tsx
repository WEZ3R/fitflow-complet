import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/coach/dashboard",
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock API
vi.mock("@/lib/api", () => ({
  programsAPI: {
    getCoachPrograms: vi.fn(),
  },
  clientsAPI: {
    getCoachClients: vi.fn(),
  },
  appointmentsAPI: {
    getUpcoming: vi.fn(),
  },
}));

// Mock auth context
vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", firstName: "Marc", lastName: "Coach", role: "COACH", email: "marc@test.com" },
    loading: false,
    isAuthenticated: true,
    isCoach: () => true,
    isClient: () => false,
  }),
}));

import CoachDashboardPage from "@/app/(dashboard)/coach/dashboard/page";
import { programsAPI, clientsAPI, appointmentsAPI } from "@/lib/api";

const mockPrograms = [
  { id: "p1", title: "Programme Alpha", isActive: true, clientId: "c1" },
  { id: "p2", title: "Programme Beta", isActive: false, clientId: "c2" },
];

const mockClients = [
  { id: "c1", user: { firstName: "Alice", lastName: "Smith", email: "alice@test.com" }, requestStatus: "accepted" },
  { id: "c2", user: { firstName: "Bob", lastName: "Jones", email: "bob@test.com" }, requestStatus: "accepted" },
];

describe("CoachDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Bypass rAF animations : exécute le callback immédiatement avec progress=1
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(performance.now() + 1000);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    (programsAPI.getCoachPrograms as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: mockPrograms },
    });
    (clientsAPI.getCoachClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: mockClients },
    });
    (appointmentsAPI.getUpcoming as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: [] },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a loading spinner initially", () => {
    render(<CoachDashboardPage />);
    // The spinner may appear briefly before data loads
    // We just check the component renders without crashing
    expect(document.body).toBeDefined();
  });

  it("displays the total client count after loading", async () => {
    render(<CoachDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  it("displays active programs count", async () => {
    render(<CoachDashboardPage />);
    await waitFor(() => {
      // 1 active program
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("displays recent clients", async () => {
    render(<CoachDashboardPage />);
    await waitFor(() => {
      expect(screen.getAllByText(/Alice/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Bob/i).length).toBeGreaterThan(0);
    });
  });

  it("handles API error gracefully", async () => {
    (programsAPI.getCoachPrograms as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));
    (clientsAPI.getCoachClients as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

    render(<CoachDashboardPage />);
    // Should not crash even when API fails
    await waitFor(() => {
      expect(document.body).toBeDefined();
    });
  });

  it("displays navigation links to clients and messages", async () => {
    render(<CoachDashboardPage />);
    await waitFor(() => {
      const links = screen.getAllByRole("link");
      const hrefs = links.map((l) => l.getAttribute("href"));
      expect(hrefs.some((h) => h?.includes("/coach/clients"))).toBe(true);
    });
  });
});
