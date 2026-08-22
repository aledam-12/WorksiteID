import { InMemoryChallengeStore } from "../../../backend/src/repositories/challenge-store.js";
describe('InMemoryChallengeStore', () => {
    it('should store and retrieve a challenge', async () => {
        const store = new InMemoryChallengeStore();
        const key = 'test-key';
        const challenge = 'test-challenge';
        await store.store(key, challenge);
        const retrievedChallenge = await store.get(key);
        expect(retrievedChallenge).toBe(challenge);
    });

    it('should return null when the challenge is not found', async () => {
        const store = new InMemoryChallengeStore();
        const retrievedChallenge = await store.get('non-existent-key');
        expect(retrievedChallenge).toBeNull();
    });

    it('should delete a challenge', async () => {
        const store = new InMemoryChallengeStore();
        const key = 'test-key';
        const challenge = 'test-challenge';
        await store.store(key, challenge);
        await store.delete(key);
        const retrievedChallenge = await store.get(key);
        expect(retrievedChallenge).toBeNull();
    });
    it('should overwrite an existing challenge', async () => {
        const store = new InMemoryChallengeStore();
        const key = 'test-key';
        const challenge = 'test-challenge';
        await store.store(key, challenge);
        const newChallenge = 'new-test-challenge';
        await store.store(key, newChallenge);
        const retrievedChallenge = await store.get(key);
        expect(retrievedChallenge).toBe(newChallenge);
    });
});