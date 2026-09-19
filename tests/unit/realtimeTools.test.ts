import { describe, it, expect } from "vitest";
import { REALTIME_TOOLS, executeRealtimeTool } from "../../src/lib/services/realtimeTools";

describe("Realtime Tools Schema & Capability Bridge", () => {
  it("defines valid function tools matching OpenAI Realtime schema", () => {
    expect(REALTIME_TOOLS.length).toBeGreaterThanOrEqual(4);

    const toolNames = REALTIME_TOOLS.map((t) => t.name);
    expect(toolNames).toContain("search_doctors");
    expect(toolNames).toContain("check_availability");
    expect(toolNames).toContain("create_appointment");
    expect(toolNames).toContain("get_questionnaire");

    for (const tool of REALTIME_TOOLS) {
      expect(tool.type).toBe("function");
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(tool.parameters.type).toBe("object");
      expect(tool.parameters.properties).toBeDefined();
    }
  });

  it("bridges executeRealtimeTool to CapabilityManager for doctor search", async () => {
    const result = await executeRealtimeTool("search_doctors", {
      specialty: "Dermatology",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].name).toContain("Dr. Sarah Patel");
  });
});
