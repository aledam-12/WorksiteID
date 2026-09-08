package tests

import (
	"chaincode/domain"
	"testing"
	"time"
)

func TestNewSanction(t *testing.T) {
	now := time.Date(2026, 9, 6, 12, 0, 0, 0, time.UTC)

	t.Run("creazione valida con dati corretti e trim degli spazi", func(t *testing.T) {
		sanction, err := domain.NewSanction(
			"  SANCT-001  ",
			"  LIC-123  ",
			5,
			"  Mancato uso del casco protettivo  ",
			now,
			"  INSP-99  ",
		)

		if err != nil {
			t.Fatalf("errore inatteso nella creazione sanzione: %v", err)
		}
		if sanction == nil {
			t.Fatal("sanzione non dovrebbe essere nil")
		}
		if sanction.ID != "SANCT-001" {
			t.Errorf("ID atteso 'SANCT-001', ottenuto '%s'", sanction.ID)
		}
		if sanction.LicenseID != "LIC-123" {
			t.Errorf("LicenseID atteso 'LIC-123', ottenuto '%s'", sanction.LicenseID)
		}
		if sanction.Penalty != 5 {
			t.Errorf("Penalty atteso 5, ottenuto %d", sanction.Penalty)
		}
		if sanction.Reason != "Mancato uso del casco protettivo" {
			t.Errorf("Reason atteso 'Mancato uso del casco protettivo', ottenuto '%s'", sanction.Reason)
		}
		if !sanction.IssuedAt.Equal(now) {
			t.Errorf("IssuedAt atteso %v, ottenuto %v", now, sanction.IssuedAt)
		}
		if sanction.InspectorID != "INSP-99" {
			t.Errorf("InspectorID atteso 'INSP-99', ottenuto '%s'", sanction.InspectorID)
		}
	})

	tests := []struct {
		name        string
		id          string
		licenseID   string
		penalty     int
		reason      string
		issuedAt    time.Time
		inspectorID string
		errMsg      string
	}{
		{
			name:        "ID vuoto",
			id:          "",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "ID cannot be empty",
		},
		{
			name:        "ID composto solo da spazi",
			id:          "   ",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "ID cannot be empty",
		},
		{
			name:        "LicenseID vuoto",
			id:          "SANCT-1",
			licenseID:   "",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "License ID cannot be empty",
		},
		{
			name:        "LicenseID composto solo da spazi",
			id:          "SANCT-1",
			licenseID:   "   ",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "License ID cannot be empty",
		},
		{
			name:        "Penalità zero",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     0,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "Penalty must be greater than 0",
		},
		{
			name:        "Penalità negativa",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     -3,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "Penalty must be greater than 0",
		},
		{
			name:        "Reason vuoto",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "Reason cannot be empty",
		},
		{
			name:        "Reason composto solo da spazi",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "    ",
			issuedAt:    now,
			inspectorID: "INSP-01",
			errMsg:      "Reason cannot be empty",
		},
		{
			name:        "InspectorID vuoto",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "",
			errMsg:      "Inspector ID cannot be empty",
		},
		{
			name:        "InspectorID composto solo da spazi",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    now,
			inspectorID: "   ",
			errMsg:      "Inspector ID cannot be empty",
		},
		{
			name:        "IssuedAt zero value",
			id:          "SANCT-1",
			licenseID:   "LIC-123",
			penalty:     5,
			reason:      "Motivo valido",
			issuedAt:    time.Time{},
			inspectorID: "INSP-01",
			errMsg:      "IssuedAt cannot be zero",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sanction, err := domain.NewSanction(tt.id, tt.licenseID, tt.penalty, tt.reason, tt.issuedAt, tt.inspectorID)

			if err == nil {
				t.Fatalf("atteso errore con messaggio '%s', ma err è nil", tt.errMsg)
			}
			if sanction != nil {
				t.Fatalf("atteso sanction nil in caso di errore, ma ottenuto: %+v", sanction)
			}
			if err.Error() != tt.errMsg {
				t.Errorf("messaggio di errore atteso '%s', ottenuto '%s'", tt.errMsg, err.Error())
			}
		})
	}
}
