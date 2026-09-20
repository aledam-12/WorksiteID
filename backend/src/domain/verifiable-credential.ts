/**
 * Soggetto della Verifiable Credential per la patente del cantiere.
 * Contiene esclusivamente l'associazione essenziale tra lavoratore e patente.
 * Nessun dato privato (crediti, sanzioni, randomness) è memorizzato nella credenziale.
 */
export interface CredentialSubject {
    workerId: string;
    licenseRef: string;
}

/**
 * Metadati della prova crittografica apposta dall'Issuer.
 */
export interface CredentialProof {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    signature: string;
}

/**
 * Modello Verifiable Credential minimale per la patente del lavoratore.
 * Ispirato al modello concettuale W3C, include l'identità dell'issuer,
 * il soggetto attestato (workerId e licenseRef) e la prova crittografica.
 */
export interface WorksiteLicenseCredential {
    id: string;
    type: string[];
    issuer: string;
    issuanceDate: string;
    credentialSubject: CredentialSubject;
    proof: CredentialProof;
}

export const DEFAULT_CREDENTIAL_TYPE = Object.freeze([
    "VerifiableCredential",
    "WorksiteLicenseCredential",
]);

export const DEFAULT_PROOF_TYPE = "Ed25519Signature2020";
export const DEFAULT_PROOF_PURPOSE = "assertionMethod";

/**
 * Costruisce in modo rigoroso e deterministico la stringa canonica
 * dei dati della credenziale soggetti a firma digitale.
 *
 * L'ordine dei campi e delle proprietà annidate è fissato esplicitamente
 * per garantire una serializzazione deterministica ed evitare discrepanze
 * tra emissione e verifica crittografica.
 */
export function canonicalizeCredentialPayload(credential: {
    id?: string;
    type?: string[];
    issuer?: string;
    issuanceDate?: string;
    credentialSubject?: {
        workerId?: string;
        licenseRef?: string;
    };
    proof?: {
        created?: string;
    };
    proofCreated?: string;
}): string {
    const sortedTypes = Array.isArray(credential.type)
        ? [...credential.type].sort()
        : [];

    const proofCreatedRaw =
        credential.proofCreated ?? credential.proof?.created;

    const canonicalObject = {
        id: typeof credential.id === "string" ? credential.id.trim() : "",
        type: sortedTypes,
        issuer: typeof credential.issuer === "string" ? credential.issuer.trim() : "",
        issuanceDate:
            typeof credential.issuanceDate === "string"
                ? credential.issuanceDate.trim()
                : "",
        credentialSubject: {
            licenseRef:
                typeof credential.credentialSubject?.licenseRef === "string"
                    ? credential.credentialSubject.licenseRef.trim()
                    : "",
            workerId:
                typeof credential.credentialSubject?.workerId === "string"
                    ? credential.credentialSubject.workerId.trim()
                    : "",
        },
        proofCreated:
            typeof proofCreatedRaw === "string" ? proofCreatedRaw.trim() : "",
    };

    return JSON.stringify(canonicalObject);
}
