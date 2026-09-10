import { describe, it, expect, vi } from "vitest";

// Mock axios before importing api
vi.mock("axios", () => {
  const mockAxios = {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  };
  return { default: mockAxios };
});

describe("API service", () => {
  it("is importable without error", async () => {
    const mod = await import("@/lib/api");
    expect(mod).toBeDefined();
  });

  it("exports authAPI", async () => {
    const { authAPI } = await import("@/lib/api");
    expect(typeof authAPI.login).toBe("function");
    expect(typeof authAPI.register).toBe("function");
    expect(typeof authAPI.getMe).toBe("function");
  });

  it("exports programsAPI", async () => {
    const { programsAPI } = await import("@/lib/api");
    expect(typeof programsAPI.create).toBe("function");
    expect(typeof programsAPI.getCoachPrograms).toBe("function");
    expect(typeof programsAPI.getClientPrograms).toBe("function");
    expect(typeof programsAPI.getById).toBe("function");
    expect(typeof programsAPI.update).toBe("function");
    expect(typeof programsAPI.delete).toBe("function");
  });

  it("exports sessionsAPI", async () => {
    const { sessionsAPI } = await import("@/lib/api");
    expect(typeof sessionsAPI.upsert).toBe("function");
    expect(typeof sessionsAPI.validate).toBe("function");
    expect(typeof sessionsAPI.getByProgram).toBe("function");
    expect(typeof sessionsAPI.getById).toBe("function");
    expect(typeof sessionsAPI.delete).toBe("function");
  });

  it("exports clientsAPI", async () => {
    const { clientsAPI } = await import("@/lib/api");
    expect(typeof clientsAPI.getCoachClients).toBe("function");
    expect(typeof clientsAPI.getById).toBe("function");
  });

  it("exports statsAPI", async () => {
    const { statsAPI } = await import("@/lib/api");
    expect(typeof statsAPI.upsert).toBe("function");
    expect(typeof statsAPI.getClientStats).toBe("function");
    expect(typeof statsAPI.getAggregated).toBe("function");
    expect(typeof statsAPI.getByDate).toBe("function");
  });

  it("exports messagesAPI", async () => {
    const { messagesAPI } = await import("@/lib/api");
    expect(typeof messagesAPI.send).toBe("function");
    expect(typeof messagesAPI.getConversation).toBe("function");
    expect(typeof messagesAPI.markAsRead).toBe("function");
    expect(typeof messagesAPI.delete).toBe("function");
  });

  it("exports templatesAPI", async () => {
    const { templatesAPI } = await import("@/lib/api");
    expect(typeof templatesAPI.create).toBe("function");
    expect(typeof templatesAPI.getAll).toBe("function");
    expect(typeof templatesAPI.apply).toBe("function");
  });

  it("exports analyticsAPI", async () => {
    const { analyticsAPI } = await import("@/lib/api");
    expect(typeof analyticsAPI.getCoachClients).toBe("function");
    expect(typeof analyticsAPI.getClientStats).toBe("function");
    expect(typeof analyticsAPI.getClientProgress).toBe("function");
    expect(typeof analyticsAPI.getGoalsCompletion).toBe("function");
  });
});
