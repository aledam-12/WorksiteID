'use client'

// API Client - unified communication layer with WorksiteID backend
import type {
  AuthUser,
  AuthResponse,
  RegisterWorkerPayload,
  RegisterWorkerResponse,
  CompleteRegistrationResponse,
  AuthOptionsResponse,
  AddPasskeyOptionsResponse,
  License,
  VerificationChallenge,
  ZkpProofResponse,
  VerificationResult,
  Sanction,
  Credential,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from './types'

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/api' : 'http://localhost:3000/api')

export class APIError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

class APIClient {
  private token: string | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('sessionId')
    }
  }

  setToken(token: string | null) {
    this.token = token
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('sessionId', token)
      } else {
        localStorage.removeItem('sessionId')
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('sessionId')
    }
    return this.token
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...((options?.headers as Record<string, string>) || {}),
    }

    if (options?.body !== undefined && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json'
    }

    const currentToken = this.getToken()
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      })
    } catch {
      throw new APIError('Impossibile contattare il server di sicurezza. Verifica la connessione di rete.', 0, 'NETWORK_ERROR')
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const serverMessage = errorData.message || errorData.error

      if (response.status === 401) {
        this.setToken(null)
        throw new APIError(serverMessage || 'Sessione scaduta o non autorizzata. Effettua nuovamente il login con la tua passkey.', 401, 'UNAUTHORIZED')
      }

      if (response.status === 403) {
        throw new APIError(serverMessage || 'Operazione non autorizzata per il tuo ruolo.', 403, 'FORBIDDEN')
      }

      if (response.status === 404) {
        throw new APIError(serverMessage || 'Risorsa richiesta non trovata.', 404, 'NOT_FOUND')
      }

      if (response.status === 409) {
        throw new APIError(serverMessage || 'Conflitto: la risorsa esiste già o operazione duplicata.', 409, 'CONFLICT')
      }

      if (response.status === 422) {
        throw new APIError(serverMessage || 'Dati inviati non validi.', 422, 'VALIDATION_ERROR')
      }

      if (response.status === 429) {
        throw new APIError('Troppe richieste inoltrate. Attendi qualche istante prima di riprovare.', 429, 'RATE_LIMITED')
      }

      if (response.status >= 500) {
        throw new APIError(serverMessage || 'Si è verificato un errore sul server. Riprova più tardi.', response.status, 'SERVER_ERROR')
      }

      throw new APIError(serverMessage || `Errore richiesta HTTP ${response.status}`, response.status)
    }

    return response.json()
  }

  // Auth endpoints (Pure WebAuthn FIDO2 / Passkeys - No mock or demo bypass)
  auth = {
    // 2-Phase Atomic Registration
    startRegistration: async (payload: RegisterWorkerPayload): Promise<RegisterWorkerResponse> => {
      return this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    },

    completeRegistration: async (
      pendingRegistrationId: string,
      response: RegistrationResponseJSON
    ): Promise<CompleteRegistrationResponse> => {
      return this.request('/auth/register/complete', {
        method: 'POST',
        body: JSON.stringify({ pendingRegistrationId, response }),
      })
    },

    // WebAuthn Passkey Login (Client-agnostic: identity derived strictly by backend)
    getAuthenticationOptions: async (): Promise<AuthOptionsResponse> => {
      return this.request('/auth/webauthn/options', {
        method: 'POST',
      })
    },

    verifyAuthentication: async (
      authSessionId: string,
      response: AuthenticationResponseJSON
    ): Promise<AuthResponse> => {
      return this.request('/auth/webauthn/verify', {
        method: 'POST',
        body: JSON.stringify({ authSessionId, response }),
      })
    },

    // Multi-Device: Add a new Passkey to existing authenticated account
    addPasskeyOptions: async (): Promise<AddPasskeyOptionsResponse> => {
      return this.request('/auth/webauthn/credentials/add-options', {
        method: 'POST',
      })
    },

    addPasskeyComplete: async (
      addSessionId: string,
      response: RegistrationResponseJSON
    ): Promise<{ success: boolean }> => {
      return this.request('/auth/webauthn/credentials/add-complete', {
        method: 'POST',
        body: JSON.stringify({ addSessionId, response }),
      })
    },

    getCurrentUser: async (): Promise<AuthUser> => {
      return this.request('/auth/me')
    },

    logout: async (): Promise<void> => {
      try {
        await this.request('/auth/logout', { method: 'POST' })
      } finally {
        this.setToken(null)
      }
    },
  }

  // Worker endpoints
  worker = {
    getLicense: async (): Promise<License> => {
      return this.request('/worker/license')
    },

    getVerificationChallenge: async (): Promise<VerificationChallenge> => {
      return this.request('/worker/verify/challenge', { method: 'POST' })
    },

    generateZkpProof: async (challengeId: string): Promise<ZkpProofResponse> => {
      return this.request('/worker/verify/generate-proof', {
        method: 'POST',
        body: JSON.stringify({ challengeId }),
      })
    },

    submitVerification: async (
      challengeId: string,
      proof?: unknown,
      publicSignals?: unknown,
      proofString?: string
    ): Promise<VerificationResult> => {
      return this.request('/worker/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeId, proof, publicSignals, proofString }),
      })
    },

    getCredential: async (): Promise<Credential> => {
      return this.request('/worker/credential')
    },
  }

  // Inspector endpoints
  inspector = {
    verifyLicense: async (licenseRef: string): Promise<VerificationResult> => {
      return this.request('/inspector/verify', {
        method: 'POST',
        body: JSON.stringify({ licenseRef }),
      })
    },

    issueSanction: async (
      licenseRef: string,
      penalty: number,
      reason: string
    ): Promise<Sanction> => {
      return this.request('/inspector/sanctions', {
        method: 'POST',
        body: JSON.stringify({ licenseRef, penalty, reason }),
      })
    },

    getSanctions: async (licenseRef?: string): Promise<Sanction[]> => {
      const query = licenseRef ? `?licenseRef=${encodeURIComponent(licenseRef)}` : ''
      return this.request(`/inspector/sanctions${query}`)
    },

    getSanctionById: async (sanctionId: string): Promise<Sanction> => {
      return this.request(`/inspector/sanctions/${sanctionId}`)
    },
  }

  // Credential verification (public endpoint)
  credential = {
    verify: async (credentialData: string | object): Promise<VerificationResult> => {
      return this.request('/public/credential/verify', {
        method: 'POST',
        body: JSON.stringify({ credentialData }),
      })
    },
  }
}

export const apiClient = new APIClient()
