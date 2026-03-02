import { describe, it, expect } from "vitest";
import {
  mapApimApiToSummary,
  mapApimOperationToApiOperation,
  mapApimProductToApiProduct,
  type ApimApiContract,
  type ApimOperationContract,
  type ApimProductContract
} from "./types";

describe("types — mapper functions", () => {
  describe("mapApimApiToSummary", () => {
    const baseContract: ApimApiContract = {
      id: "api-1",
      name: "Fleet API",
      description: "Fleet management API"
    };

    it("maps basic fields", () => {
      const result = mapApimApiToSummary(baseContract);
      expect(result.id).toBe("api-1");
      expect(result.name).toBe("Fleet API");
      expect(result.description).toBe("Fleet management API");
    });

    it("defaults status to Production", () => {
      const result = mapApimApiToSummary(baseContract);
      expect(result.status).toBe("Production");
    });

    it("detects Sandbox from name", () => {
      const result = mapApimApiToSummary({ ...baseContract, name: "Fleet Sandbox API" });
      expect(result.status).toBe("Sandbox");
    });

    it("detects Sandbox from path", () => {
      const result = mapApimApiToSummary({ ...baseContract, path: "/sandbox/fleet" });
      expect(result.status).toBe("Sandbox");
    });

    it("detects Sandbox from test keyword", () => {
      const result = mapApimApiToSummary({ ...baseContract, name: "Test Fleet API" });
      expect(result.status).toBe("Sandbox");
    });

    it("defaults category to General", () => {
      const result = mapApimApiToSummary(baseContract);
      expect(result.category).toBe("General");
    });

    it("uses first tag as category", () => {
      const result = mapApimApiToSummary({ ...baseContract, tags: ["Integration", "Fleet"] });
      expect(result.category).toBe("Integration");
    });

    it("sets plan to Free when not subscription required", () => {
      const result = mapApimApiToSummary({ ...baseContract, subscriptionRequired: false });
      expect(result.plan).toBe("Free");
    });

    it("sets plan to Paid when subscription required", () => {
      const result = mapApimApiToSummary({ ...baseContract, subscriptionRequired: true });
      expect(result.plan).toBe("Paid");
    });

    it("defaults owner to Komatsu when no contact", () => {
      const result = mapApimApiToSummary(baseContract);
      expect(result.owner).toBe("Komatsu");
    });

    it("uses contact name as owner", () => {
      const result = mapApimApiToSummary({
        ...baseContract,
        contact: { name: "Fleet Team", email: "fleet@komatsu.com" }
      });
      expect(result.owner).toBe("Fleet Team");
    });

    it("sets source to apim", () => {
      const result = mapApimApiToSummary(baseContract);
      expect(result.source).toBe("apim");
    });

    it("includes optional fields", () => {
      const result = mapApimApiToSummary({
        ...baseContract,
        path: "/fleet/v1",
        protocols: ["https"],
        apiVersion: "1.0",
        type: "http"
      });
      expect(result.path).toBe("/fleet/v1");
      expect(result.protocols).toEqual(["https"]);
      expect(result.apiVersion).toBe("1.0");
      expect(result.type).toBe("http");
    });

    it("handles empty description", () => {
      const result = mapApimApiToSummary({ ...baseContract, description: undefined });
      expect(result.description).toBe("");
    });

    it("handles non-array tags", () => {
      const result = mapApimApiToSummary({ ...baseContract, tags: undefined });
      expect(result.tags).toEqual([]);
      expect(result.category).toBe("General");
    });
  });

  describe("mapApimOperationToApiOperation", () => {
    it("maps basic operation fields", () => {
      const op: ApimOperationContract = {
        id: "op-1",
        name: "getVehicles",
        method: "GET",
        urlTemplate: "/vehicles",
        description: "Get all vehicles"
      };
      const result = mapApimOperationToApiOperation(op);
      expect(result.id).toBe("op-1");
      expect(result.name).toBe("getVehicles");
      expect(result.method).toBe("GET");
      expect(result.urlTemplate).toBe("/vehicles");
      expect(result.description).toBe("Get all vehicles");
    });

    it("uses displayName when provided", () => {
      const op: ApimOperationContract = {
        id: "op-1",
        name: "getVehicles",
        method: "GET",
        urlTemplate: "/vehicles",
        displayName: "Get Vehicles"
      };
      const result = mapApimOperationToApiOperation(op);
      expect(result.displayName).toBe("Get Vehicles");
    });

    it("falls back to name when displayName not provided", () => {
      const op: ApimOperationContract = {
        id: "op-1",
        name: "getVehicles",
        method: "GET",
        urlTemplate: "/vehicles"
      };
      const result = mapApimOperationToApiOperation(op);
      expect(result.displayName).toBe("getVehicles");
    });
  });

  describe("mapApimProductToApiProduct", () => {
    it("maps basic product fields", () => {
      const p: ApimProductContract = {
        id: "prod-1",
        name: "basic-product",
        displayName: "Basic Product",
        description: "A basic product"
      };
      const result = mapApimProductToApiProduct(p);
      expect(result.id).toBe("prod-1");
      expect(result.name).toBe("Basic Product");
      expect(result.description).toBe("A basic product");
    });

    it("falls back to name when no displayName", () => {
      const p: ApimProductContract = {
        id: "prod-1",
        name: "basic-product"
      };
      const result = mapApimProductToApiProduct(p);
      expect(result.name).toBe("basic-product");
    });

    it("sets plan to Free when no subscription required", () => {
      const p: ApimProductContract = {
        id: "prod-1",
        name: "free-product",
        subscriptionRequired: false
      };
      const result = mapApimProductToApiProduct(p);
      expect(result.plan).toBe("Free");
    });

    it("sets plan to Paid when subscription required", () => {
      const p: ApimProductContract = {
        id: "prod-1",
        name: "paid-product",
        subscriptionRequired: true
      };
      const result = mapApimProductToApiProduct(p);
      expect(result.plan).toBe("Paid");
    });
  });
});
