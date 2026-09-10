import { render, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock API before importing context
vi.mock("@/lib/api", () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
  },
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { authAPI } from "@/lib/api";
import { useEffect } from "react";

function TestConsumer({ onValues }: { onValues: (v: ReturnType<typeof useAuth>) => void }) {
  const auth = useAuth();
  useEffect(() => { onValues(auth); });
  return null;
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer onValues={() => {}} />)).toThrow();
    consoleSpy.mockRestore();
  });

  it("starts with loading=true then resolves to user=null when no token", async () => {
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedValues?.loading).toBe(false);
    });
    expect(capturedValues?.user).toBeNull();
    expect(capturedValues?.isAuthenticated).toBe(false);
  });

  it("restores user from token on mount", async () => {
    const mockUser = { id: "1", email: "coach@test.com", role: "COACH", firstName: "Coach", lastName: "Test" };
    localStorageMock.getItem.mockReturnValue("valid-token");
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: mockUser } });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedValues?.loading).toBe(false);
    });
    expect(capturedValues?.user?.email).toBe("coach@test.com");
    expect(capturedValues?.isAuthenticated).toBe(true);
  });

  it("login sets user and stores token", async () => {
    const mockUser = { id: "1", email: "coach@test.com", role: "COACH", firstName: "Coach", lastName: "Test" };
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
    (authAPI.login as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: { user: mockUser, token: "jwt-token" } },
    });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedValues?.loading).toBe(false));

    let result: { success: boolean } = { success: false };
    await act(async () => {
      result = await capturedValues!.login({ email: "coach@test.com", password: "pass" });
    });

    expect(result.success).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith("token", "jwt-token");
    await waitFor(() => expect(capturedValues?.user?.email).toBe("coach@test.com"));
  });

  it("login returns error on failure", async () => {
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: null } });
    (authAPI.login as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { message: "Invalid credentials" } },
    });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedValues?.loading).toBe(false));

    let result: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      result = await capturedValues!.login({ email: "bad@test.com", password: "wrong" });
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid credentials");
  });

  it("isCoach returns true for COACH role", async () => {
    const mockUser = { id: "1", email: "coach@test.com", role: "COACH", firstName: "C", lastName: "C" };
    localStorageMock.getItem.mockReturnValue("token");
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: mockUser } });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedValues?.loading).toBe(false));
    expect(capturedValues?.isCoach()).toBe(true);
    expect(capturedValues?.isClient()).toBe(false);
  });

  it("isClient returns true for CLIENT role", async () => {
    const mockUser = { id: "2", email: "client@test.com", role: "CLIENT", firstName: "C", lastName: "C" };
    localStorageMock.getItem.mockReturnValue("token");
    (authAPI.getMe as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: mockUser } });

    let capturedValues: ReturnType<typeof useAuth> | null = null;
    render(
      <AuthProvider>
        <TestConsumer onValues={(v) => { capturedValues = v; }} />
      </AuthProvider>
    );

    await waitFor(() => expect(capturedValues?.loading).toBe(false));
    expect(capturedValues?.isClient()).toBe(true);
    expect(capturedValues?.isCoach()).toBe(false);
  });
});
