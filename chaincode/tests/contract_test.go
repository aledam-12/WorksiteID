package tests

import (
	"chaincode/contracts"
	"chaincode/domain"
	"testing"
	"time"

	"github.com/hyperledger/fabric-chaincode-go/shimtest"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func newTestContext() contractapi.TransactionContextInterface {
	stub := shimtest.NewMockStub("mock_chaincode", nil)
	stub.MockTransactionStart("tx-test")
	ctx := new(contractapi.TransactionContext)
	ctx.SetStub(stub)
	return ctx
}

func TestContract_CreateLicense(t *testing.T) {
	contract := new(contracts.SanctionsContract)

	t.Run("creazione valida", func(t *testing.T) {
		ctx := newTestContext()
		err := contract.CreateLicense(ctx, "LIC-001", 30)
		if err != nil {
			t.Fatalf("errore inatteso: %v", err)
		}

		lic, err := contract.GetLicense(ctx, "LIC-001")
		if err != nil {
			t.Fatalf("errore nel recupero della patente: %v", err)
		}
		if lic == nil {
			t.Fatal("la patente dovrebbe esistere sul ledger")
		}
		if lic.ID != "LIC-001" || lic.Credits != 30 || lic.Status != domain.LicenseStatusActive {
			t.Errorf("dati patente non corretti: %+v", lic)
		}
	})

	t.Run("errore con ID vuoto", func(t *testing.T) {
		ctx := newTestContext()
		err := contract.CreateLicense(ctx, "", 30)
		if err == nil {
			t.Fatal("atteso errore per ID vuoto, ottenuto nil")
		}
	})

	t.Run("errore con credits negativi", func(t *testing.T) {
		ctx := newTestContext()
		err := contract.CreateLicense(ctx, "LIC-002", -5)
		if err == nil {
			t.Fatal("atteso errore per crediti negativi, ottenuto nil")
		}
	})
}

func TestContract_GetLicense(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	ctx := newTestContext()

	// Inserimento patente di test
	err := contract.CreateLicense(ctx, "LIC-EXIST", 25)
	if err != nil {
		t.Fatalf("setup fallito: %v", err)
	}

	t.Run("license esistente", func(t *testing.T) {
		lic, err := contract.GetLicense(ctx, "LIC-EXIST")
		if err != nil {
			t.Fatalf("errore inatteso: %v", err)
		}
		if lic == nil {
			t.Fatal("la patente esistente non dovrebbe essere nil")
		}
		if lic.ID != "LIC-EXIST" || lic.Credits != 25 {
			t.Errorf("dati errati per patente esistente: %+v", lic)
		}
	})

	t.Run("license inesistente", func(t *testing.T) {
		lic, err := contract.GetLicense(ctx, "LIC-NOT-FOUND")
		if err != nil {
			t.Fatalf("errore inatteso su chiave assente: %v", err)
		}
		if lic != nil {
			t.Fatalf("atteso nil per patente inesistente, ottenuto: %+v", lic)
		}
	})
}

func TestContract_IssueSanction_Validation(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)

	t.Run("sanzione valida", func(t *testing.T) {
		ctx := newTestContext()
		if err := contract.CreateLicense(ctx, "LIC-100", 30); err != nil {
			t.Fatalf("setup fallito: %v", err)
		}

		err := contract.IssueSanction(ctx, "SANCT-001", "LIC-100", 5, "Mancato casco", now, "INSP-01")
		if err != nil {
			t.Fatalf("errore inatteso nell'emissione della sanzione: %v", err)
		}
	})

	t.Run("license inesistente", func(t *testing.T) {
		ctx := newTestContext()
		err := contract.IssueSanction(ctx, "SANCT-002", "LIC-GHOST", 5, "Eccesso velocità", now, "INSP-01")
		if err == nil {
			t.Fatal("atteso errore per patente inesistente, ottenuto nil")
		}
	})

	t.Run("sanction già esistente", func(t *testing.T) {
		ctx := newTestContext()
		if err := contract.CreateLicense(ctx, "LIC-101", 30); err != nil {
			t.Fatalf("setup fallito: %v", err)
		}

		// Prima emissione
		err := contract.IssueSanction(ctx, "SANCT-DUP", "LIC-101", 5, "Prima violazione", now, "INSP-01")
		if err != nil {
			t.Fatalf("prima emissione fallita: %v", err)
		}

		// Seconda emissione con stesso sanctionID
		err = contract.IssueSanction(ctx, "SANCT-DUP", "LIC-101", 3, "Seconda violazione", now, "INSP-01")
		if err == nil {
			t.Fatal("atteso errore per sanzione già esistente, ottenuto nil")
		}
	})

	t.Run("penalty <= 0", func(t *testing.T) {
		ctx := newTestContext()
		_ = contract.CreateLicense(ctx, "LIC-102", 30)

		if err := contract.IssueSanction(ctx, "SANCT-003", "LIC-102", 0, "Motivo", now, "INSP-01"); err == nil {
			t.Fatal("atteso errore per penalty = 0")
		}
		if err := contract.IssueSanction(ctx, "SANCT-004", "LIC-102", -5, "Motivo", now, "INSP-01"); err == nil {
			t.Fatal("atteso errore per penalty negativa")
		}
	})

	t.Run("reason vuota", func(t *testing.T) {
		ctx := newTestContext()
		_ = contract.CreateLicense(ctx, "LIC-103", 30)

		err := contract.IssueSanction(ctx, "SANCT-005", "LIC-103", 5, "   ", now, "INSP-01")
		if err == nil {
			t.Fatal("atteso errore per reason vuota")
		}
	})

	t.Run("inspectorID vuoto", func(t *testing.T) {
		ctx := newTestContext()
		_ = contract.CreateLicense(ctx, "LIC-104", 30)

		err := contract.IssueSanction(ctx, "SANCT-006", "LIC-104", 5, "Motivo", now, "   ")
		if err == nil {
			t.Fatal("atteso errore per inspectorID vuoto")
		}
	})

	t.Run("issuedAt zero", func(t *testing.T) {
		ctx := newTestContext()
		_ = contract.CreateLicense(ctx, "LIC-105", 30)

		err := contract.IssueSanction(ctx, "SANCT-007", "LIC-105", 5, "Motivo", time.Time{}, "INSP-01")
		if err == nil {
			t.Fatal("atteso errore per issuedAt zero")
		}
	})
}

func TestContract_CreditRules(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name           string
		initialCredits int
		penalty        int
		expectedCred   int
		expectedStatus string
	}{
		{
			name:           "30 - 5 = 25 ACTIVE",
			initialCredits: 30,
			penalty:        5,
			expectedCred:   25,
			expectedStatus: domain.LicenseStatusActive,
		},
		{
			name:           "15 - 1 = 14 REVOKED",
			initialCredits: 15,
			penalty:        1,
			expectedCred:   14,
			expectedStatus: domain.LicenseStatusRevoked,
		},
		{
			name:           "20 - 20 = 0 REVOKED",
			initialCredits: 20,
			penalty:        20,
			expectedCred:   0,
			expectedStatus: domain.LicenseStatusRevoked,
		},
		{
			name:           "10 - 20 = 0 REVOKED (mai crediti negativi)",
			initialCredits: 10,
			penalty:        20,
			expectedCred:   0,
			expectedStatus: domain.LicenseStatusRevoked,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := newTestContext()
			licID := "LIC-TEST"
			sanctID := "SANCT-TEST"

			if err := contract.CreateLicense(ctx, licID, tt.initialCredits); err != nil {
				t.Fatalf("CreateLicense fallita: %v", err)
			}

			if err := contract.IssueSanction(ctx, sanctID, licID, tt.penalty, "Violazione", now, "INSP-01"); err != nil {
				t.Fatalf("IssueSanction fallita: %v", err)
			}

			updatedLic, err := contract.GetLicense(ctx, licID)
			if err != nil {
				t.Fatalf("GetLicense fallita: %v", err)
			}
			if updatedLic.Credits != tt.expectedCred {
				t.Errorf("crediti attesi %d, ottenuti %d", tt.expectedCred, updatedLic.Credits)
			}
			if updatedLic.Status != tt.expectedStatus {
				t.Errorf("stato atteso %s, ottenuto %s", tt.expectedStatus, updatedLic.Status)
			}
		})
	}

	t.Run("REVOKED -> IssueSanction -> REVOKED (mai REVOKED -> ACTIVE)", func(t *testing.T) {
		ctx := newTestContext()
		licID := "LIC-REVOKED"

		// Patente creata con crediti < 15, quindi parte direttamente come REVOKED
		if err := contract.CreateLicense(ctx, licID, 14); err != nil {
			t.Fatalf("CreateLicense fallita: %v", err)
		}

		licBefore, _ := contract.GetLicense(ctx, licID)
		if licBefore.Status != domain.LicenseStatusRevoked {
			t.Fatalf("stato iniziale atteso REVOKED, ottenuto %s", licBefore.Status)
		}

		// Sanzione applicata a patente già revocata
		if err := contract.IssueSanction(ctx, "SANCT-REV-1", licID, 4, "Ulteriore violazione", now, "INSP-01"); err != nil {
			t.Fatalf("IssueSanction fallita: %v", err)
		}

		licAfter, err := contract.GetLicense(ctx, licID)
		if err != nil {
			t.Fatalf("GetLicense fallita: %v", err)
		}
		if licAfter.Credits != 10 {
			t.Errorf("crediti attesi 10, ottenuti %d", licAfter.Credits)
		}
		if licAfter.Status != domain.LicenseStatusRevoked {
			t.Errorf("stato atteso sempre REVOKED, ottenuto %s", licAfter.Status)
		}
	})
}

func TestContract_PersistenceOnLedger(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	ctx := newTestContext()
	now := time.Date(2026, 9, 6, 12, 30, 0, 0, time.UTC)

	licenseID := "LIC-PERSIST-01"
	sanctionID := "SANCT-PERSIST-01"
	inspectorID := "INSP-PERSIST-99"

	// 1. Creazione iniziale della patente
	if err := contract.CreateLicense(ctx, licenseID, 30); err != nil {
		t.Fatalf("CreateLicense fallita: %v", err)
	}

	// 2. Esecuzione IssueSanction
	err := contract.IssueSanction(ctx, sanctionID, licenseID, 8, "Mancata revisione DPI", now, inspectorID)
	if err != nil {
		t.Fatalf("IssueSanction fallita: %v", err)
	}

	// 3. Verifica persistenza effettiva su Ledger di License (PutState verificato tramite GetLicense/GetState)
	licFromLedger, err := contract.GetLicense(ctx, licenseID)
	if err != nil {
		t.Fatalf("GetLicense ha restituito errore: %v", err)
	}
	if licFromLedger == nil {
		t.Fatal("License non trovata sul ledger dopo IssueSanction!")
	}
	if licFromLedger.Credits != 22 {
		t.Errorf("crediti sul ledger non aggiornati: attesi 22, ottenuti %d", licFromLedger.Credits)
	}
	if licFromLedger.Status != domain.LicenseStatusActive {
		t.Errorf("status sul ledger errato: atteso ACTIVE, ottenuto %s", licFromLedger.Status)
	}

	// 4. Verifica persistenza effettiva su Ledger di Sanction (PutState verificato tramite GetSanction/GetState)
	sanctFromLedger, err := contract.GetSanction(ctx, sanctionID)
	if err != nil {
		t.Fatalf("GetSanction ha restituito errore: %v", err)
	}
	if sanctFromLedger == nil {
		t.Fatal("Sanction non trovata sul ledger dopo IssueSanction!")
	}
	if sanctFromLedger.ID != sanctionID {
		t.Errorf("Sanction.ID errato: atteso %s, ottenuto %s", sanctionID, sanctFromLedger.ID)
	}
	if sanctFromLedger.LicenseID != licenseID {
		t.Errorf("Sanction.LicenseID errato: atteso %s, ottenuto %s", licenseID, sanctFromLedger.LicenseID)
	}
	if sanctFromLedger.Penalty != 8 {
		t.Errorf("Sanction.Penalty errato: atteso 8, ottenuto %d", sanctFromLedger.Penalty)
	}
	if sanctFromLedger.Reason != "Mancata revisione DPI" {
		t.Errorf("Sanction.Reason errato: ottenuto %s", sanctFromLedger.Reason)
	}
	if sanctFromLedger.InspectorID != inspectorID {
		t.Errorf("Sanction.InspectorID errato: atteso %s, ottenuto %s", inspectorID, sanctFromLedger.InspectorID)
	}
	if !sanctFromLedger.IssuedAt.Equal(now) {
		t.Errorf("Sanction.IssuedAt errato: atteso %v, ottenuto %v", now, sanctFromLedger.IssuedAt)
	}
}
