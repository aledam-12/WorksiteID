package tests

import (
	"chaincode/domain"
	"encoding/json"
	"strings"
	"testing"
)

func TestNewPublicLicenseState(t *testing.T) {
	t.Run("creazione valida", func(t *testing.T) {
		state, err := domain.NewPublicLicenseState(
			"LIC-REF-001",
			strings.Repeat("a", 64),
		)

		if err != nil {
			t.Fatalf("errore inatteso: %v", err)
		}

		if state == nil {
			t.Fatal("stato pubblico non dovrebbe essere nil")
		}

		if state.LicenseRef != "LIC-REF-001" {
			t.Errorf(
				"LicenseRef atteso 'LIC-REF-001', ottenuto '%s'",
				state.LicenseRef,
			)
		}

		if state.Commitment != strings.Repeat("a", 64) {
			t.Errorf(
				"commitment errato: %s",
				state.Commitment,
			)
		}

		if state.Version != 1 {
			t.Errorf(
				"versione iniziale attesa 1, ottenuta %d",
				state.Version,
			)
		}
	})

	t.Run("LicenseRef vuoto", func(t *testing.T) {
		state, err := domain.NewPublicLicenseState(
			"",
			strings.Repeat("a", 64),
		)

		if err == nil {
			t.Fatal("atteso errore per LicenseRef vuoto")
		}

		if state != nil {
			t.Fatalf(
				"stato atteso nil, ottenuto %+v",
				state,
			)
		}
	})

	t.Run("commitment vuoto", func(t *testing.T) {
		state, err := domain.NewPublicLicenseState(
			"LIC-REF-001",
			"",
		)

		if err == nil {
			t.Fatal("atteso errore per commitment vuoto")
		}

		if state != nil {
			t.Fatalf(
				"stato atteso nil, ottenuto %+v",
				state,
			)
		}
	})
}

func TestPublicLicenseStateSerializationContainsOnlyPublicFields(t *testing.T) {
	state, err := domain.NewPublicLicenseState(
		"LIC-REF-001",
		strings.Repeat("a", 64),
	)
	if err != nil {
		t.Fatalf("creazione stato fallita: %v", err)
	}

	raw, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("serializzazione fallita: %v", err)
	}

	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("JSON non valido: %v", err)
	}

	expectedFields := []string{
		"licenseRef",
		"commitment",
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

func TestPublicLicenseStateUpdateCommitment(t *testing.T) {
	state, err := domain.NewPublicLicenseState(
		"LIC-REF-001",
		strings.Repeat("a", 64),
	)
	if err != nil {
		t.Fatalf("creazione stato fallita: %v", err)
	}

	newCommitment := strings.Repeat("b", 64)

	if err := state.UpdateCommitment(newCommitment, 1); err != nil {
		t.Fatalf("UpdateCommitment fallita: %v", err)
	}

	if state.Commitment != newCommitment {
		t.Errorf(
			"commitment atteso %s, ottenuto %s",
			newCommitment,
			state.Commitment,
		)
	}

	if state.Version != 2 {
		t.Errorf(
			"versione attesa 2, ottenuta %d",
			state.Version,
		)
	}
}

func TestPublicLicenseStateUpdateCommitmentRejectsEmptyCommitment(t *testing.T) {
	state, err := domain.NewPublicLicenseState(
		"LIC-REF-001",
		strings.Repeat("a", 64),
	)
	if err != nil {
		t.Fatalf("creazione stato fallita: %v", err)
	}

	err = state.UpdateCommitment("", 1)

	if err == nil {
		t.Fatal("atteso errore per nuovo commitment vuoto")
	}

	if state.Commitment != strings.Repeat("a", 64) {
		t.Error("il commitment non dovrebbe essere modificato dopo un errore")
	}

	if state.Version != 1 {
		t.Errorf(
			"la versione dovrebbe rimanere 1, ottenuta %d",
			state.Version,
		)
	}
}
