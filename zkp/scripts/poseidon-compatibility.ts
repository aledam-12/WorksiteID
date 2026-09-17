import { buildPoseidon } from "circomlibjs";

async function main(): Promise<void> {
    const poseidon = await buildPoseidon();

    const inputs = [
        123n,
        30n,
        1n,
    ];

    const hash = poseidon(inputs);

    const commitment = poseidon.F.toString(hash);

    console.log("Inputs:");
    console.log(inputs);

    console.log("Poseidon commitment:");
    console.log(commitment);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});