export interface ChallengeStore {
    store(key: string, challenge: string): Promise<void>;
    get(key: string): Promise<string | null>;
    delete(key: string): Promise<void>;
}

export class InMemoryChallengeStore implements ChallengeStore {
    private readonly challenges: Map<string, string> = new Map();

    async store(key: string, challenge: string): Promise<void> {
        this.challenges.set(key, challenge);
    }

    async get(key: string): Promise<string | null> {
        return this.challenges.get(key) ?? null;
    }

    async delete(key: string): Promise<void> {
        this.challenges.delete(key);
    }
}