// API/Domain types for WorksiteID
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser'

export type UserType = 'worker' | 'inspector'
export type LicenseStatus = 'ACTIVE' | 'REVOKED'

// Auth types
export interface AuthUser {
  id: string
  userId: string
  userType: UserType
  name: string
  surname: string
  company?: string
  cf?: string
}

export interface AuthResponse {
  user: AuthUser
  sessionId: string
}

// Registration types
export interface RegisterWorkerPayload {
  name: string
  surname: string
  cf: string
  company?: string
  userType?: 'worker' | 'inspector'
}

export interface RegisterWorkerResponse {
  pendingRegistrationId: string
  options: PublicKeyCredentialCreationOptionsJSON
}

export interface CompleteRegistrationResponse {
  success: boolean
  userId: string
  userType?: 'worker' | 'inspector'
  sessionId?: string
  user?: AuthUser
}

export interface AuthOptionsResponse {
  options: PublicKeyCredentialRequestOptionsJSON
  authSessionId: string
}

export interface AddPasskeyOptionsResponse {
  options: PublicKeyCredentialCreationOptionsJSON
  addSessionId: string
}

// License types (Strict ZKP: numeric credits hidden from worker view)
export interface License {
  licenseRef: string
  status: LicenseStatus
  version: number
  lastUpdated: string
  verificationEligibility: 'ELIGIBLE' | 'NOT_ELIGIBLE'
}

// Verification types
export interface VerificationChallenge {
  challengeId: string
  nonce?: string
  expiresAt?: string | number | Date
  createdAt?: string
}

export interface VerificationResult {
  result: 'PASS' | 'NOT_PASS'
  verifiedAt: string
  reason?: string
  status?: string
  credentialSubject?: CredentialSubject
  issuer?: string
}

// Sanction types
export interface Sanction {
  sanctionId: string
  licenseRef: string
  penalty: number
  reason: string
  issuedAt: string
  inspectorRef: string
}

// W3C Verifiable Credential types
export interface CredentialSubject {
  workerId: string
  licenseRef: string
}

export interface CredentialProof {
  type: string
  created: string
  proofPurpose: string
  verificationMethod: string
  signature: string
}

export interface Credential {
  '@context'?: string[]
  id: string
  type: string[]
  issuer: string
  issuanceDate: string
  credentialSubject: CredentialSubject
  proof: CredentialProof
}

export type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
}
