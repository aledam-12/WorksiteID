import { Inspector } from "../../../backend/src/domain/inspector.js";

describe("Inspector Domain Model", () => {
    it("should instantiate a valid inspector", () => {
        const inspector = new Inspector("INSP-001");

        expect(inspector.id).toBe("INSP-001");
        expect(inspector.toString()).toBe("INSP-001");
    });

    it("should reject an empty inspector ID", () => {
        expect(() => new Inspector("")).toThrow(
            "Inspector ID must be a non-empty string.",
        );
    });

    it("should reject a whitespace-only inspector ID", () => {
        expect(() => new Inspector("   ")).toThrow(
            "Inspector ID must be a non-empty string.",
        );
    });

    it("should trim leading and trailing whitespace from the inspector ID", () => {
        const inspector = new Inspector("  INSP-001  ");

        expect(inspector.id).toBe("INSP-001");
    });

    it("should expose the inspector ID as read-only", () => {
        const inspector = new Inspector("INSP-001");

        expect(inspector.id).toBe("INSP-001");
    });
});