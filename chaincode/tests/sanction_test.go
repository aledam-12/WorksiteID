package tests

import (
	"chaincode/domain"
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func TestNewSanction(t *testing.T) {
	issuedAt := time.Date(
		2026,
		9,
		6,
		12,
		0,
		0,
		0,
		time.UTC,
	)

	t.Run("creazione valida con trim degli spazi", func(t *testing.T) {
		sanction, err := domain.NewSanction(
			"  SANCT-001  ",
			"  LIC-REF-123  ",
			strings.Repeat("a", 64),
			issuedAt,
			"  INSP-REF-99  ",
			2,
		)

		if err != nil {
			t.Fatalf("errore inatteso: %v", err)
		}

		if sanction == nil {
			t.Fatal("sanzione non dovrebbe essere nil")
		}

		if sanction.ID != "SANCT-001" {
			t.Errorf("ID atteso 'SANCT-001', ottenuto '%s'", sanction.ID)
		}

		if sanction.LicenseRef != "LIC-REF-123" {
			t.Errorf(
				"LicenseRef atteso 'LIC-REF-123', ottenuto '%s'",
				sanction.LicenseRef,
			)
		}

		if sanction.SanctionCommitment != strings.Repeat("a", 64) {
			t.Errorf(
				"SanctionCommitment errato: %s",
				sanction.SanctionCommitment,
			)
		}

		if !sanction.IssuedAt.Equal(issuedAt) {
			t.Errorf(
				"IssuedAt atteso %v, ottenuto %v",
				issuedAt,
				sanction.IssuedAt,
			)
		}

		if sanction.InspectorRef != "INSP-REF-99" {
			t.Errorf(
				"InspectorRef atteso 'INSP-REF-99', ottenuto '%s'",
				sanction.InspectorRef,
			)
		}

		if sanction.Version != 2 {
			t.Errorf(
				"Version attesa 2, ottenuta %d",
				sanction.Version,
			)
		}
	})

	tests := []struct {
		name               string
		id                 string
		licenseRef         string
		sanctionCommitment string
		issuedAt           time.Time
		inspectorRef       string
		version            int
		errMsg             string
	}{
		{
			name:               "ID vuoto",
			id:                 "",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "ID cannot be empty",
		},
		{
			name:               "ID composto solo da spazi",
			id:                 "   ",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "ID cannot be empty",
		},
		{
			name:               "LicenseRef vuoto",
			id:                 "SANCT-001",
			licenseRef:         "",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "LicenseRef cannot be empty",
		},
		{
			name:               "LicenseRef composto solo da spazi",
			id:                 "SANCT-001",
			licenseRef:         "   ",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "LicenseRef cannot be empty",
		},
		{
			name:               "SanctionCommitment vuoto",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: "",
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "SanctionCommitment cannot be empty",
		},
		{
			name:               "SanctionCommitment composto solo da spazi",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: "   ",
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "SanctionCommitment cannot be empty",
		},
		{
			name:               "IssuedAt zero value",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           time.Time{},
			inspectorRef:       "INSP-REF-01",
			version:            2,
			errMsg:             "IssuedAt cannot be zero",
		},
		{
			name:               "InspectorRef vuoto",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "",
			version:            2,
			errMsg:             "InspectorRef cannot be empty",
		},
		{
			name:               "InspectorRef composto solo da spazi",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "   ",
			version:            2,
			errMsg:             "InspectorRef cannot be empty",
		},
		{
			name:               "versione zero",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            0,
			errMsg:             "Version must be greater than or equal to 1",
		},
		{
			name:               "versione negativa",
			id:                 "SANCT-001",
			licenseRef:         "LIC-REF-123",
			sanctionCommitment: strings.Repeat("a", 64),
			issuedAt:           issuedAt,
			inspectorRef:       "INSP-REF-01",
			version:            -1,
			errMsg:             "Version must be greater than or equal to 1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sanction, err := domain.NewSanction(
				tt.id,
				tt.licenseRef,
				tt.sanctionCommitment,
				tt.issuedAt,
				tt.inspectorRef,
				tt.version,
			)

			if err == nil {
				t.Fatalf(
					"atteso errore '%s', ma err è nil",
					tt.errMsg,
				)
			}

			if sanction != nil {
				t.Fatalf(
					"atteso sanction nil in caso di errore, ottenuto: %+v",
					sanction,
				)
			}

			if err.Error() != tt.errMsg {
				t.Errorf(
					"messaggio atteso '%s', ottenuto '%s'",
					tt.errMsg,
					err.Error(),
				)
			}
		})
	}
}

func TestSanctionSerializationContainsOnlyPublicFields(t *testing.T) {
	issuedAt := time.Date(
		2026,
		9,
		6,
		12,
		0,
		0,
		0,
		time.UTC,
	)

	sanction, err := domain.NewSanction(
		"SANCT-001",
		"LIC-REF-001",
		strings.Repeat("b", 64),
		issuedAt,
		"INSP-REF-001",
		2,
	)
	if err != nil {
		t.Fatalf("creazione sanzione fallita: %v", err)
	}

	raw, err := json.Marshal(sanction)
	if err != nil {
		t.Fatalf("serializzazione fallita: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("JSON non valido: %v", err)
	}

	expectedFields := []string{
		"id",
		"licenseRef",
		"sanctionCommitment",
		"issuedAt",
		"inspectorRef",
		"version",
	}

	if len(payload) != len(expectedFields) {
		t.Fatalf(
			"numero campi inatteso: attesi %d, ottenuti %d: %s",
			len(expectedFields),
			len(payload),
			string(raw),
		)
	}

	for _, field := range expectedFields {
		if _, exists := payload[field]; !exists {
			t.Errorf(
				"campo pubblico atteso %q assente dal JSON",
				field,
			)
		}
	}

	forbiddenFields := []string{
		"licenseId",
		"licenseID",
		"credits",
		"status",
		"randomness",
		"penalty",
		"reason",
		"reasonHash",
		"inspectorId",
		"inspectorID",
	}

	for _, field := range forbiddenFields {
		if _, exists := payload[field]; exists {
			t.Errorf(
				"campo privato %q NON deve essere presente nel ledger: %s",
				field,
				string(raw),
			)
		}
	}
}
