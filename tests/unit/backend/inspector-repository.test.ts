import { InspectorRepository, InMemoryInspectorRepository } from "../../../backend/src/repositories/inspector-repository.js";
import { Inspector } from "../../../backend/src/domain/inspector.js";

describe("InspectorRepository", () => {
    let repository: InspectorRepository;

    beforeEach(() => {
        repository = new InMemoryInspectorRepository();
    });

    it("should register a new inspector", async () => {
        const inspector = new Inspector("INSP-001");

        await repository.register(inspector);

        const foundInspector = await repository.findById("INSP-001");
        expect(foundInspector).toEqual(inspector);
    });

    it("should find an inspector by ID", async () => {
        const inspector = new Inspector("INSP-002");
        await repository.register(inspector);

        const foundInspector = await repository.findById("INSP-002");
        expect(foundInspector).toEqual(inspector);
    });

    it("should reject duplicate inspector IDs", async () => {
        const firstInspector = new Inspector("INSP-001");
        const secondInspector = new Inspector("INSP-001");

        await repository.register(firstInspector);

        await expect(
            repository.register(secondInspector),
        ).rejects.toThrow();
    });
    
    it("should return null when no inspector is found", async () => {
        const foundInspector = await repository.findById("INSP-999");
        expect(foundInspector).toBeNull();
    });

    it("should check if an inspector exists by ID", async () => {
        const inspector = new Inspector("INSP-003");
        await repository.register(inspector);

        const exists = await repository.existsById("INSP-003");
        expect(exists).toBe(true);

        const notExists = await repository.existsById("INSP-999");
        expect(notExists).toBe(false);
    });
});