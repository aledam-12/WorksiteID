/**
 * @file index.ts
 * @description Modulo radice per l'esportazione unificata dei sottosistemi di sicurezza:
 * Blockchain (Hyperledger Fabric), ZKP (SnarkJS/Groth16), VC (W3C Verifiable Credentials) e WebAuthn (FIDO2 Passkeys).
 */

export * as Blockchain from "./blockchain/index.js";
export * as ZKP from "./zkp/index.js";
export * as VC from "./vc/index.js";
export * as WebAuthn from "./webauthn/index.js";

// Direct named re-exports for convenience
export * from "./blockchain/index.js";
export * from "./zkp/index.js";
export * from "./vc/index.js";
export * from "./webauthn/index.js";
