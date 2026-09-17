pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template LicenseVerification() {
    // --------------------------------------------------
    // Private witness
    // --------------------------------------------------

    signal input credits;
    signal input status;
    signal input version;
    signal input randomness;

    // --------------------------------------------------
    // Public inputs
    // --------------------------------------------------

    signal input commitment;
    signal input challenge;
    signal input challengeBinding;

    // --------------------------------------------------
    // 1. credits >= 15
    // --------------------------------------------------

    component creditsCheck = LessThan(32);

    creditsCheck.in[0] <== credits;
    creditsCheck.in[1] <== 15;

    creditsCheck.out === 0;

    // --------------------------------------------------
    // 2. Commitment
    // --------------------------------------------------

    component commitmentHash = Poseidon(4);

    commitmentHash.inputs[0] <== credits;
    commitmentHash.inputs[1] <== status;
    commitmentHash.inputs[2] <== version;
    commitmentHash.inputs[3] <== randomness;

    commitmentHash.out === commitment;

    // --------------------------------------------------
    // 3. Challenge binding
    // --------------------------------------------------

    component challengeHash = Poseidon(3);

    challengeHash.inputs[0] <== commitment;
    challengeHash.inputs[1] <== challenge;
    challengeHash.inputs[2] <== randomness;

    challengeHash.out === challengeBinding;
}

component main {
    public [
        commitment,
        challenge,
        challengeBinding
    ]
} = LicenseVerification();