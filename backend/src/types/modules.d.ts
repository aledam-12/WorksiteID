declare module "circomlibjs" {
    export interface PoseidonFunction {
        (inputs: bigint[]): bigint;
        F: {
            toString(element: bigint): string;
            e(element: bigint | string | number): bigint;
        };
    }
    export function buildPoseidon(): Promise<PoseidonFunction>;
}

declare module "snarkjs" {
    export const groth16: {
        fullProve(
            input: unknown,
            wasmFile: string,
            zkeyFile: string,
            logger?: unknown,
        ): Promise<{ proof: unknown; publicSignals: string[] }>;
        verify(
            vKey: unknown,
            publicSignals: string[],
            proof: unknown,
            logger?: unknown,
        ): Promise<boolean>;
    };
}
