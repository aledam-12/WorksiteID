package tests

import (
	"chaincode/contracts"
	"encoding/json"
	"strings"
	"testing"

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

func getRawLedgerState(
	t *testing.T,
	ctx contractapi.TransactionContextInterface,
	key string,
) []byte {
	t.Helper()

	raw, err := ctx.GetStub().GetState(key)
	if err != nil {
		t.Fatalf(
			"errore durante GetState(%s): %v",
			key,
			err,
		)
	}

	if raw == nil {
		t.Fatalf(
			"nessuno stato trovato sul ledger per key %s",
			key,
		)
	}

	return raw
}

func assertLedgerDoesNotContainFields(
	t *testing.T,
	raw []byte,
	forbiddenFields ...string,
) {
	t.Helper()

	var payload map[string]any

	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf(
			"stato ledger non contiene JSON valido: %v; raw=%s",
			err,
			string(raw),
		)
	}

	for _, field := range forbiddenFields {
		if _, exists := payload[field]; exists {
			t.Errorf(
				"campo privato %q presente nel ledger: %s",
				field,
				string(raw),
			)
		}
	}
}

func assertLedgerHasExactlyFields(
	t *testing.T,
	raw []byte,
	expectedFields ...string,
) {
	t.Helper()

	var payload map[string]any

	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf(
			"stato ledger non contiene JSON valido: %v",
			err,
		)
	}

	if len(payload) != len(expectedFields) {
		t.Fatalf(
			"numero campi inatteso: attesi %d, ottenuti %d; payload=%s",
			len(expectedFields),
			len(payload),
			string(raw),
		)
	}

	for _, field := range expectedFields {
		if _, exists := payload[field]; !exists {
			t.Errorf(
				"campo atteso %q assente dal ledger: %s",
				field,
				string(raw),
			)
		}
	}
}

func TestContract_CreateLicense(t *testing.T) {
	contract := new(contracts.SanctionsContract)

	t.Run("creazione valida dello stato pubblico", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-001"
		initialCommitment := strings.Repeat("a", 64)

		err := contract.CreateLicense(
			ctx,
			licenseRef,
			initialCommitment,
		)
		if err != nil {
			t.Fatalf(
				"errore inatteso: %v",
				err,
			)
		}

		state, err := contract.GetLicenseState(
			ctx,
			licenseRef,
		)
		if err != nil {
			t.Fatalf(
				"errore nel recupero dello stato: %v",
				err,
			)
		}

		if state == nil {
			t.Fatal("lo stato dovrebbe esistere sul ledger")
		}

		if state.LicenseRef != licenseRef {
			t.Errorf(
				"LicenseRef atteso %s, ottenuto %s",
				licenseRef,
				state.LicenseRef,
			)
		}

		if state.Commitment != initialCommitment {
			t.Errorf(
				"commitment atteso %s, ottenuto %s",
				initialCommitment,
				state.Commitment,
			)
		}

		if state.Version != 1 {
			t.Errorf(
				"versione attesa 1, ottenuta %d",
				state.Version,
			)
		}

		raw := getRawLedgerState(
			t,
			ctx,
			licenseRef,
		)

		assertLedgerHasExactlyFields(
			t,
			raw,
			"licenseRef",
			"commitment",
			"version",
		)

		assertLedgerDoesNotContainFields(
			t,
			raw,
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
			"inspectorRef",
		)
	})

	t.Run("licenseRef vuoto", func(t *testing.T) {
		ctx := newTestContext()

		err := contract.CreateLicense(
			ctx,
			"",
			strings.Repeat("a", 64),
		)

		if err == nil {
			t.Fatal(
				"atteso errore per licenseRef vuoto",
			)
		}
	})

	t.Run("commitment vuoto", func(t *testing.T) {
		ctx := newTestContext()

		err := contract.CreateLicense(
			ctx,
			"LIC-REF-002",
			"",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per commitment vuoto",
			)
		}
	})

	t.Run("licenseRef duplicato", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-DUP"
		commitment := strings.Repeat("a", 64)

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			commitment,
		); err != nil {
			t.Fatalf(
				"prima creazione fallita: %v",
				err,
			)
		}

		err := contract.CreateLicense(
			ctx,
			licenseRef,
			strings.Repeat("b", 64),
		)

		if err == nil {
			t.Fatal(
				"atteso errore per licenseRef già esistente",
			)
		}
	})
}

func TestContract_GetLicenseState(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	ctx := newTestContext()

	licenseRef := "LIC-REF-EXIST"
	commitment := strings.Repeat("a", 64)

	if err := contract.CreateLicense(
		ctx,
		licenseRef,
		commitment,
	); err != nil {
		t.Fatalf(
			"setup fallito: %v",
			err,
		)
	}

	t.Run("stato esistente", func(t *testing.T) {
		state, err := contract.GetLicenseState(
			ctx,
			licenseRef,
		)
		if err != nil {
			t.Fatalf(
				"errore inatteso: %v",
				err,
			)
		}

		if state == nil {
			t.Fatal(
				"lo stato esistente non dovrebbe essere nil",
			)
		}

		if state.LicenseRef != licenseRef {
			t.Errorf(
				"LicenseRef errato: %s",
				state.LicenseRef,
			)
		}

		if state.Commitment != commitment {
			t.Errorf(
				"commitment errato: %s",
				state.Commitment,
			)
		}

		if state.Version != 1 {
			t.Errorf(
				"versione attesa 1, ottenuta %d",
				state.Version,
			)
		}
	})

	t.Run("stato inesistente", func(t *testing.T) {
		state, err := contract.GetLicenseState(
			ctx,
			"LIC-REF-NOT-FOUND",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per patente inesistente",
			)
		}

		if state != nil {
			t.Fatalf(
				"stato atteso nil, ottenuto %+v",
				state,
			)
		}
	})
}

func TestContract_IssueSanction(t *testing.T) {
	contract := new(contracts.SanctionsContract)

	t.Run("emissione valida", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-100"
		initialCommitment := strings.Repeat("a", 64)
		sanctionCommitment := strings.Repeat("b", 64)
		newCommitment := strings.Repeat("c", 64)

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			initialCommitment,
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-001",
			licenseRef,
			sanctionCommitment,
			newCommitment,
			"INSP-REF-001",
		)

		if err != nil {
			t.Fatalf(
				"errore inatteso nell'emissione: %v",
				err,
			)
		}

		state, err := contract.GetLicenseState(
			ctx,
			licenseRef,
		)
		if err != nil {
			t.Fatalf(
				"GetLicenseState fallita: %v",
				err,
			)
		}

		if state.Commitment != newCommitment {
			t.Errorf(
				"nuovo commitment atteso %s, ottenuto %s",
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

		rawLicense := getRawLedgerState(
			t,
			ctx,
			licenseRef,
		)

		assertLedgerHasExactlyFields(
			t,
			rawLicense,
			"licenseRef",
			"commitment",
			"version",
		)

		assertLedgerDoesNotContainFields(
			t,
			rawLicense,
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
			"inspectorRef",
		)

		rawSanction := getRawLedgerState(
			t,
			ctx,
			"SANCT-001",
		)

		assertLedgerHasExactlyFields(
			t,
			rawSanction,
			"id",
			"licenseRef",
			"sanctionCommitment",
			"issuedAt",
			"inspectorRef",
			"version",
		)

		assertLedgerDoesNotContainFields(
			t,
			rawSanction,
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
		)
	})

	t.Run("licenseRef inesistente", func(t *testing.T) {
		ctx := newTestContext()

		err := contract.IssueSanction(
			ctx,
			"SANCT-002",
			"LIC-REF-GHOST",
			strings.Repeat("a", 64),
			strings.Repeat("b", 64),
			"INSP-REF-001",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per licenseRef inesistente",
			)
		}
	})

	t.Run("sanctionID duplicato", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-DUP-SANCTION"

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			strings.Repeat("a", 64),
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-DUP",
			licenseRef,
			strings.Repeat("b", 64),
			strings.Repeat("c", 64),
			"INSP-REF-001",
		)
		if err != nil {
			t.Fatalf(
				"prima emissione fallita: %v",
				err,
			)
		}

		err = contract.IssueSanction(
			ctx,
			"SANCT-DUP",
			licenseRef,
			strings.Repeat("d", 64),
			strings.Repeat("e", 64),
			"INSP-REF-002",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per sanctionID duplicato",
			)
		}
	})

	t.Run("sanctionCommitment vuoto", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-EMPTY-SC"

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			strings.Repeat("a", 64),
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-EMPTY-SC",
			licenseRef,
			"",
			strings.Repeat("b", 64),
			"INSP-REF-001",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per sanctionCommitment vuoto",
			)
		}
	})

	t.Run("newCommitment vuoto", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-EMPTY-NC"

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			strings.Repeat("a", 64),
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-EMPTY-NC",
			licenseRef,
			strings.Repeat("b", 64),
			"",
			"INSP-REF-001",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per newCommitment vuoto",
			)
		}
	})

	t.Run("newCommitment uguale al commitment corrente", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-SAME-COMMITMENT"
		commitment := strings.Repeat("a", 64)

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			commitment,
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-SAME-COMMITMENT",
			licenseRef,
			strings.Repeat("b", 64),
			commitment,
			"INSP-REF-001",
		)

		if err == nil {
			t.Fatal(
				"atteso errore quando il nuovo commitment coincide con quello corrente",
			)
		}
	})

	t.Run("inspectorRef vuoto", func(t *testing.T) {
		ctx := newTestContext()

		licenseRef := "LIC-REF-EMPTY-INSPECTOR"

		if err := contract.CreateLicense(
			ctx,
			licenseRef,
			strings.Repeat("a", 64),
		); err != nil {
			t.Fatalf(
				"setup fallito: %v",
				err,
			)
		}

		err := contract.IssueSanction(
			ctx,
			"SANCT-EMPTY-INSPECTOR",
			licenseRef,
			strings.Repeat("b", 64),
			strings.Repeat("c", 64),
			"   ",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per inspectorRef vuoto",
			)
		}
	})
}

func TestContract_GetSanction(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	ctx := newTestContext()

	licenseRef := "LIC-REF-SANCTION"
	sanctionID := "SANCT-GET-001"
	sanctionCommitment := strings.Repeat("a", 64)
	newCommitment := strings.Repeat("b", 64)

	if err := contract.CreateLicense(
		ctx,
		licenseRef,
		strings.Repeat("c", 64),
	); err != nil {
		t.Fatalf(
			"setup fallito: %v",
			err,
		)
	}

	if err := contract.IssueSanction(
		ctx,
		sanctionID,
		licenseRef,
		sanctionCommitment,
		newCommitment,
		"INSP-REF-001",
	); err != nil {
		t.Fatalf(
			"setup IssueSanction fallito: %v",
			err,
		)
	}

	t.Run("sanzione esistente", func(t *testing.T) {
		sanction, err := contract.GetSanction(
			ctx,
			sanctionID,
		)

		if err != nil {
			t.Fatalf(
				"errore inatteso: %v",
				err,
			)
		}

		if sanction == nil {
			t.Fatal(
				"sanzione esistente non dovrebbe essere nil",
			)
		}

		if sanction.ID != sanctionID {
			t.Errorf(
				"ID atteso %s, ottenuto %s",
				sanctionID,
				sanction.ID,
			)
		}

		if sanction.LicenseRef != licenseRef {
			t.Errorf(
				"LicenseRef atteso %s, ottenuto %s",
				licenseRef,
				sanction.LicenseRef,
			)
		}

		if sanction.SanctionCommitment != sanctionCommitment {
			t.Errorf(
				"SanctionCommitment errato: %s",
				sanction.SanctionCommitment,
			)
		}

		if sanction.InspectorRef != "INSP-REF-001" {
			t.Errorf(
				"InspectorRef errato: %s",
				sanction.InspectorRef,
			)
		}

		if sanction.Version != 2 {
			t.Errorf(
				"versione attesa 2, ottenuta %d",
				sanction.Version,
			)
		}
	})

	t.Run("sanzione inesistente", func(t *testing.T) {
		sanction, err := contract.GetSanction(
			ctx,
			"SANCT-NOT-FOUND",
		)

		if err == nil {
			t.Fatal(
				"atteso errore per sanzione inesistente",
			)
		}

		if sanction != nil {
			t.Fatalf(
				"sanzione attesa nil, ottenuta %+v",
				sanction,
			)
		}
	})
}

func TestContract_PersistenceOnLedger(t *testing.T) {
	contract := new(contracts.SanctionsContract)
	ctx := newTestContext()

	licenseRef := "LIC-REF-PERSIST-01"
	sanctionID := "SANCT-PERSIST-01"

	initialCommitment := strings.Repeat("a", 64)
	sanctionCommitment := strings.Repeat("b", 64)
	newCommitment := strings.Repeat("c", 64)

	if err := contract.CreateLicense(
		ctx,
		licenseRef,
		initialCommitment,
	); err != nil {
		t.Fatalf(
			"CreateLicense fallita: %v",
			err,
		)
	}

	if err := contract.IssueSanction(
		ctx,
		sanctionID,
		licenseRef,
		sanctionCommitment,
		newCommitment,
		"INSP-REF-PERSIST-99",
	); err != nil {
		t.Fatalf(
			"IssueSanction fallita: %v",
			err,
		)
	}

	licenseRaw := getRawLedgerState(
		t,
		ctx,
		licenseRef,
	)

	assertLedgerHasExactlyFields(
		t,
		licenseRaw,
		"licenseRef",
		"commitment",
		"version",
	)

	assertLedgerDoesNotContainFields(
		t,
		licenseRaw,
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
		"inspectorRef",
	)

	sanctionRaw := getRawLedgerState(
		t,
		ctx,
		sanctionID,
	)

	assertLedgerHasExactlyFields(
		t,
		sanctionRaw,
		"id",
		"licenseRef",
		"sanctionCommitment",
		"issuedAt",
		"inspectorRef",
		"version",
	)

	assertLedgerDoesNotContainFields(
		t,
		sanctionRaw,
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
	)

	var licensePayload map[string]any
	if err := json.Unmarshal(licenseRaw, &licensePayload); err != nil {
		t.Fatalf(
			"JSON license non valido: %v",
			err,
		)
	}

	if licensePayload["licenseRef"] != licenseRef {
		t.Errorf(
			"licenseRef errato nel ledger: %v",
			licensePayload["licenseRef"],
		)
	}

	if licensePayload["commitment"] != newCommitment {
		t.Errorf(
			"commitment errato nel ledger: %v",
			licensePayload["commitment"],
		)
	}

	if licensePayload["version"] != float64(2) {
		t.Errorf(
			"versione errata nel ledger: %v",
			licensePayload["version"],
		)
	}

	var sanctionPayload map[string]any
	if err := json.Unmarshal(sanctionRaw, &sanctionPayload); err != nil {
		t.Fatalf(
			"JSON sanction non valido: %v",
			err,
		)
	}

	if sanctionPayload["id"] != sanctionID {
		t.Errorf(
			"id sanzione errato nel ledger: %v",
			sanctionPayload["id"],
		)
	}

	if sanctionPayload["licenseRef"] != licenseRef {
		t.Errorf(
			"licenseRef sanzione errato: %v",
			sanctionPayload["licenseRef"],
		)
	}

	if sanctionPayload["sanctionCommitment"] != sanctionCommitment {
		t.Errorf(
			"sanctionCommitment errato: %v",
			sanctionPayload["sanctionCommitment"],
		)
	}

	if sanctionPayload["inspectorRef"] != "INSP-REF-PERSIST-99" {
		t.Errorf(
			"inspectorRef errato: %v",
			sanctionPayload["inspectorRef"],
		)
	}

	if sanctionPayload["version"] != float64(2) {
		t.Errorf(
			"versione sanzione errata: %v",
			sanctionPayload["version"],
		)
	}
}
