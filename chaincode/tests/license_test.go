package tests

import (
	"chaincode/domain"
	"testing"
)

func TestNewLicense(t *testing.T) {
	tests := []struct {
		name           string
		id             string
		credits        int
		wantErr        bool
		expectedStatus string
	}{
		{
			name:           "crea patente attiva con crediti >= 15",
			id:             "LIC-001",
			credits:        20,
			wantErr:        false,
			expectedStatus: domain.LicenseStatusActive,
		},
		{
			name:           "crea patente attiva con esattamente 15 crediti (limite)",
			id:             "LIC-002",
			credits:        15,
			wantErr:        false,
			expectedStatus: domain.LicenseStatusActive,
		},
		{
			name:           "crea patente revocata con crediti < 15",
			id:             "LIC-003",
			credits:        14,
			wantErr:        false,
			expectedStatus: domain.LicenseStatusRevoked,
		},
		{
			name:           "crea patente revocata con 0 crediti",
			id:             "LIC-004",
			credits:        0,
			wantErr:        false,
			expectedStatus: domain.LicenseStatusRevoked,
		},
		{
			name:           "errore se ID vuoto",
			id:             "",
			credits:        20,
			wantErr:        true,
			expectedStatus: "",
		},
		{
			name:           "errore se crediti negativi",
			id:             "LIC-005",
			credits:        -5,
			wantErr:        true,
			expectedStatus: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lic, err := domain.NewLicense(tt.id, tt.credits)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("atteso errore per input (%s, %d), ma err è nil", tt.id, tt.credits)
				}
				if lic != nil {
					t.Fatalf("attesa licenza nil in caso di errore, ma ottenuto: %+v", lic)
				}
				return
			}

			if err != nil {
				t.Fatalf("errore inatteso: %v", err)
			}
			if lic == nil {
				t.Fatal("licenza è nil")
			}
			if lic.ID != tt.id {
				t.Errorf("ID atteso %s, ottenuto %s", tt.id, lic.ID)
			}
			if lic.Credits != tt.credits {
				t.Errorf("Credits attesi %d, ottenuti %d", tt.credits, lic.Credits)
			}
			if lic.Status != tt.expectedStatus {
				t.Errorf("Status atteso %s, ottenuto %s", tt.expectedStatus, lic.Status)
			}
		})
	}
}

func TestApplyPenalty(t *testing.T) {
	t.Run("penalità valida riduce crediti mantenendo stato attivo", func(t *testing.T) {
		lic, err := domain.NewLicense("LIC-100", 20)
		if err != nil {
			t.Fatalf("creazione fallita: %v", err)
		}

		err = lic.ApplyPenalty(3)
		if err != nil {
			t.Fatalf("ApplyPenalty ha restituito errore: %v", err)
		}
		if lic.Credits != 17 {
			t.Errorf("crediti attesi 17, ottenuti %d", lic.Credits)
		}
		if lic.Status != domain.LicenseStatusActive {
			t.Errorf("stato atteso %s, ottenuto %s", domain.LicenseStatusActive, lic.Status)
		}
	})

	t.Run("penalità che porta i crediti sotto 15 revoca la patente", func(t *testing.T) {
		lic, err := domain.NewLicense("LIC-101", 20)
		if err != nil {
			t.Fatalf("creazione fallita: %v", err)
		}

		err = lic.ApplyPenalty(10)
		if err != nil {
			t.Fatalf("ApplyPenalty ha restituito errore: %v", err)
		}
		if lic.Credits != 10 {
			t.Errorf("crediti attesi 10, ottenuti %d", lic.Credits)
		}
		if lic.Status != domain.LicenseStatusRevoked {
			t.Errorf("stato atteso %s, ottenuto %s", domain.LicenseStatusRevoked, lic.Status)
		}
	})

	t.Run("penalità maggiore dei crediti residui non scende sotto 0", func(t *testing.T) {
		lic, err := domain.NewLicense("LIC-102", 5)
		if err != nil {
			t.Fatalf("creazione fallita: %v", err)
		}

		err = lic.ApplyPenalty(20)
		if err != nil {
			t.Fatalf("ApplyPenalty ha restituito errore: %v", err)
		}
		if lic.Credits != 0 {
			t.Errorf("crediti attesi 0, ottenuti %d", lic.Credits)
		}
		if lic.Status != domain.LicenseStatusRevoked {
			t.Errorf("stato atteso %s, ottenuto %s", domain.LicenseStatusRevoked, lic.Status)
		}
	})

	t.Run("errore con penalità zero o negativa", func(t *testing.T) {
		lic, err := domain.NewLicense("LIC-103", 20)
		if err != nil {
			t.Fatalf("creazione fallita: %v", err)
		}

		if err := lic.ApplyPenalty(0); err == nil {
			t.Error("atteso errore per penalità = 0, ma err è nil")
		}
		if err := lic.ApplyPenalty(-2); err == nil {
			t.Error("atteso errore per penalità negativa, ma err è nil")
		}
		// Verifica che i crediti non siano cambiati
		if lic.Credits != 20 {
			t.Errorf("crediti non dovrebbero cambiare dopo errore, attesi 20, ottenuti %d", lic.Credits)
		}
	})
}

func TestLicenseStatusChecks(t *testing.T) {
	t.Run("IsActive e IsRevoked su patente attiva", func(t *testing.T) {
		lic := &domain.License{ID: "LIC-200", Credits: 20, Status: domain.LicenseStatusActive}
		if !lic.IsActive() {
			t.Error("IsActive() dovrebbe essere true per patente attiva con 20 crediti")
		}
		if lic.IsRevoked() {
			t.Error("IsRevoked() dovrebbe essere false per patente attiva con 20 crediti")
		}
	})

	t.Run("IsActive e IsRevoked su patente revocata", func(t *testing.T) {
		lic := &domain.License{ID: "LIC-201", Credits: 10, Status: domain.LicenseStatusRevoked}
		if lic.IsActive() {
			t.Error("IsActive() dovrebbe essere false per patente revocata con 10 crediti")
		}
		if !lic.IsRevoked() {
			t.Error("IsRevoked() dovrebbe essere true per patente revocata con 10 crediti")
		}
	})

	t.Run("caso limite: 15 crediti attiva", func(t *testing.T) {
		lic := &domain.License{ID: "LIC-202", Credits: 15, Status: domain.LicenseStatusActive}
		if !lic.IsActive() {
			t.Error("IsActive() dovrebbe essere true per 15 crediti e status ACTIVE")
		}
		if lic.IsRevoked() {
			t.Error("IsRevoked() dovrebbe essere false per 15 crediti e status ACTIVE")
		}
	})

	t.Run("caso limite: 14 crediti revocata", func(t *testing.T) {
		lic := &domain.License{ID: "LIC-203", Credits: 14, Status: domain.LicenseStatusRevoked}
		if lic.IsActive() {
			t.Error("IsActive() dovrebbe essere false per 14 crediti")
		}
		if !lic.IsRevoked() {
			t.Error("IsRevoked() dovrebbe essere true per 14 crediti e status REVOKED")
		}
	})
}
