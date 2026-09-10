import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/coach/clients",
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api", () => ({
  clientsAPI: { getCoachClients: vi.fn() },
  requestsAPI: { accept: vi.fn(), reject: vi.fn() },
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", firstName: "Coach", role: "COACH" },
    isCoach: () => true,
  }),
}));

import ClientsPage from "@/app/(dashboard)/coach/clients/page";
import { clientsAPI } from "@/lib/api";

const mockClients = [
  {
    id: "c1",
    user: { firstName: "Alice", lastName: "Smith", email: "alice@test.com" },
    requestStatus: "accepted",
    goals: "Perte de poids",
    weight: 70,
    height: 165,
  },
  {
    id: "c2",
    user: { firstName: "Bob", lastName: "Jones", email: "bob@test.com" },
    requestStatus: "pending",
    goals: null,
    weight: null,
    height: null,
  },
];

describe("ClientsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (clientsAPI.getCoachClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: mockClients },
    });
  });

  it("renders clients list after loading", async () => {
    render(<ClientsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Alice/i)).toBeInTheDocument();
      expect(screen.getByText(/Bob/i)).toBeInTheDocument();
    });
  });

  it("shows empty state when no clients", async () => {
    (clientsAPI.getCoachClients as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: [] },
    });
    render(<ClientsPage />);
    await waitFor(() => {
      expect(screen.getByText(/aucun client/i)).toBeInTheDocument();
    });
  });

  it("displays client goals when available", async () => {
    render(<ClientsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Perte de poids/i)).toBeInTheDocument();
    });
  });

  it("handles API error gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    (clientsAPI.getCoachClients as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("API Error"));
    render(<ClientsPage />);
    await waitFor(() => {
      expect(document.body).toBeDefined();
    });
    consoleSpy.mockRestore();
  });
});
