'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { apiClient } from './api/client'
import type { AuthUser, RegisterWorkerPayload } from './api/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isAuthenticated: boolean
  loginPasskey: () => Promise<AuthUser>
  registerWorker: (payload: RegisterWorkerPayload) => Promise<{ pendingRegistrationId: string; registerPasskey: () => Promise<void> }>
  addPasskey: () => Promise<void>
  logout: () => Promise<void>
  error: string | null
  setError: (err: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user is already authenticated via valid session token
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = apiClient.getToken()
        if (token) {
          const currentUser = await apiClient.auth.getCurrentUser()
          setUser(currentUser)
        }
      } catch {
        apiClient.setToken(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Pure WebAuthn Passkey Login (No hardcoded credentials, identity determined by backend)
  const loginPasskey = async (): Promise<AuthUser> => {
    setError(null)
    try {
      // 1. Get authentication options from backend
      const { options, authSessionId } = await apiClient.auth.getAuthenticationOptions()

      // 2. Perform standard browser WebAuthn ceremony
      const authResponse = await startAuthentication({ optionsJSON: options })

      // 3. Verify on backend (backend looks up credential by response.id, determines user)
      const authResult = await apiClient.auth.verifyAuthentication(authSessionId, authResponse)

      apiClient.setToken(authResult.sessionId)
      setUser(authResult.user)
      return authResult.user
    } catch (err: unknown) {
      let message = 'Autenticazione passkey non riuscita'
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          message = 'Operazione annullata o timeout del sensore biometrico.'
        } else {
          message = err.message
        }
      }
      setError(message)
      throw new Error(message)
    }
  }

  // 2-Phase Atomic Registration:
  // Phase 1 creates pending registration (NO user created yet).
  // Phase 2 creates passkey; only on success are User and License committed!
  const registerWorker = async (payload: RegisterWorkerPayload) => {
    setError(null)
    try {
      const { pendingRegistrationId, options } = await apiClient.auth.startRegistration(payload)

      const registerPasskey = async () => {
        try {
          const regResponse = await startRegistration({ optionsJSON: options })
          const result = await apiClient.auth.completeRegistration(pendingRegistrationId, regResponse)
          if (result.sessionId && result.user) {
            apiClient.setToken(result.sessionId)
            setUser(result.user)
          }
        } catch (passkeyErr: unknown) {
          let msg = 'Registrazione passkey fallita o annullata.'
          if (passkeyErr instanceof Error) {
            if (passkeyErr.name === 'NotAllowedError') {
              msg = 'Creazione passkey annullata. Nessun account è stato registrato nel sistema.'
            } else {
              msg = passkeyErr.message
            }
          }
          setError(msg)
          throw new Error(msg)
        }
      }

      return { pendingRegistrationId, registerPasskey }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registrazione fallita'
      setError(message)
      throw err
    }
  }

  // Multi-Device: Add an extra Passkey for currently authenticated user
  const addPasskey = async () => {
    setError(null)
    try {
      const { options, addSessionId } = await apiClient.auth.addPasskeyOptions()
      const regResponse = await startRegistration({ optionsJSON: options })
      await apiClient.auth.addPasskeyComplete(addSessionId, regResponse)
    } catch (err: unknown) {
      let message = 'Aggiunta passkey fallita'
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          message = 'Operazione annullata sul dispositivo.'
        } else {
          message = err.message
        }
      }
      setError(message)
      throw new Error(message)
    }
  }

  const logout = async () => {
    try {
      await apiClient.auth.logout()
    } catch {
      // Ignora errori di rete su logout
    } finally {
      apiClient.setToken(null)
      setUser(null)
      setError(null)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: user !== null,
        loginPasskey,
        registerWorker,
        addPasskey,
        logout,
        error,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
