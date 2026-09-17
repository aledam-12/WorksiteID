import { buildPoseidon } from "circomlibjs";

async function main(): Promise<void> {
    const poseidon = await buildPoseidon();

    const credits = 30n;
    const status = 1n;
    const version = 1n;
    const randomness = 123456789n;
    const challenge = 42n;

    const commitmentHash = poseidon([
        credits,
        status,
        version,
        randomness,
    ]);

    const commitment = poseidon.F.toString(commitmentHash);

    const challengeHash = poseidon([
        BigInt(commitment),
        challenge,
        randomness,
    ]);

    const challengeBinding =
        poseidon.F.toString(challengeHash);

    console.log("commitment:", commitment);
    console.log("challenge:", challenge.toString());
    console.log("challengeBinding:", challengeBinding);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});