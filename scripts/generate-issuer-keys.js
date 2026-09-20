import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const secretsDir = path.resolve(process.cwd(), "secrets");
if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
}

const privateKeyPath = path.join(secretsDir, "issuer-private-key.pem");
const publicKeyPath = path.join(secretsDir, "issuer-public-key.pem");

if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
    console.log("Issuer Ed25519 keys already exist in ./secrets/ (skipping generation).");
    process.exit(0);
}

console.log("Generating persistent Ed25519 keypair for VC Issuer in ./secrets/...");

const keyPair = crypto.generateKeyPairSync("ed25519");
const privateKeyPem = keyPair.privateKey.export({
    type: "pkcs8",
    format: "pem",
});
const publicKeyPem = keyPair.publicKey.export({
    type: "spki",
    format: "pem",
});

fs.writeFileSync(privateKeyPath, privateKeyPem, { mode: 0o600 });
fs.writeFileSync(publicKeyPath, publicKeyPem, { mode: 0o644 });

console.log("Successfully generated:");
console.log(` - Private Key: ${privateKeyPath}`);
console.log(` - Public Key:  ${publicKeyPath}`);
