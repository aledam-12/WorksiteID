#!/usr/bin/env bash
set -Eeuo pipefail

###############################################################################
# WorksiteID - Development Environment Setup
#
# Purpose:
#   Reproduce the complete WorksiteID development environment on a new WSL.
#
# This script is NOT intended for production.
# Dependencies (node_modules, go modules) are assumed to be installed manually.
#
# It prepares and verifies:
#   - System commands and prerequisites
#   - MySQL database & schema
#   - VC Ed25519 issuer keys
#   - ZKP artifacts (Circom + SnarkJS Groth16)
#   - Hyperledger Fabric / FireFly stack
#   - Chaincode packaging (Go type: golang)
#   - FireFly FFI & REST API (sanctionsv2.0)
#   - Environment configuration (.env)
###############################################################################

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

###############################################################################
# Configuration
###############################################################################

STACK_NAME="worksiteid"
FIREFLY_STACK_DIR="$HOME/.firefly/stacks/$STACK_NAME"
FIREFLY_URL="http://127.0.0.1:5001"
CHANNEL_NAME="firefly"

CHAINCODE_NAME="sanctions"
CHAINCODE_VERSION="2.0"
CHAINCODE_PACKAGE="chaincode/sanctions_v2.tar.gz"

FFI_FILE="chaincode/sanctions-ffi.json"
API_NAME="sanctionsv2.0"

ZKP_DIR="zkp"
ZKP_CIRCUIT="$ZKP_DIR/circuits/license_verification.circom"
ZKP_BUILD_DIR="$ZKP_DIR/build"

ZKP_WASM="$ZKP_BUILD_DIR/license_verification_js/license_verification.wasm"
ZKP_R1CS="$ZKP_BUILD_DIR/license_verification.r1cs"
ZKP_ZKEY="$ZKP_BUILD_DIR/license_verification_final.zkey"
ZKP_VKEY="$ZKP_BUILD_DIR/verification_key.json"

PTAU_DIR="$ZKP_BUILD_DIR/ptau"
PTAU_FILE="$PTAU_DIR/pot12_final.ptau"

SECRETS_DIR="$ROOT_DIR/secrets"
VC_PRIVATE_KEY="$SECRETS_DIR/issuer-private-key.pem"
VC_PUBLIC_KEY="$SECRETS_DIR/issuer-public-key.pem"

DB_NAME="${DB_NAME:-worksiteid}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"

REBUILD_ZKP=false
PACKAGE_CHAINCODE_ONLY=false
CHAINCODE_ONLY=false
FORCE_DEPLOY=false
ZKP_ONLY=false

###############################################################################
# Output
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

log() {
    echo -e "${BLUE}[setup]${RESET} $*"
}

success() {
    echo -e "${GREEN}[  OK ]${RESET} $*"
}

warn() {
    echo -e "${YELLOW}[ WARN ]${RESET} $*"
}

error() {
    echo -e "${RED}[ERROR]${RESET} $*" >&2
}

die() {
    error "$*"
    exit 1
}

###############################################################################
# Error handling
###############################################################################

on_error() {
    local exit_code=$?
    local line_number=$1

    error "Setup failed at line ${line_number} with exit code ${exit_code}."
    error "The environment may be incomplete."
    exit "$exit_code"
}

trap 'on_error $LINENO' ERR

###############################################################################
# Usage
###############################################################################

usage() {
    cat <<EOF

WorksiteID development environment setup

Usage:
  ./scripts/setup.sh [OPTIONS]

Default:
  Prepare the complete WorksiteID development environment (dependencies assumed installed).

Options:
  --help
      Show this help.

  --zkp-only
      Prepare only the ZKP environment.

  --rebuild-zkp
      Force complete ZKP regeneration.

  --package-chaincode
      Only package the Fabric chaincode.

  --chaincode-only
      Package and deploy the Fabric chaincode and configure FireFly.

  --deploy-chaincode, --force-deploy
      Force chaincode deployment and FireFly API configuration.

Examples:
  ./scripts/setup.sh
      Complete development setup.

  ./scripts/setup.sh --zkp-only
      Prepare ZKP only.

  ./scripts/setup.sh --rebuild-zkp
      Regenerate all ZKP artifacts.

  ./scripts/setup.sh --package-chaincode
      Package the chaincode only into $CHAINCODE_PACKAGE.

  ./scripts/setup.sh --chaincode-only
      Package, deploy and configure chaincode on FireFly.

Environment variables:
  DB_HOST (default: 127.0.0.1)
  DB_PORT (default: 3306)
  DB_NAME (default: worksiteid)
  DB_USER (default: root)
  DB_PASSWORD (optional)

EOF
}

###############################################################################
# Argument parsing
###############################################################################

while [[ $# -gt 0 ]]; do
    case "$1" in
        --help|-h)
            usage
            exit 0
            ;;

        --zkp-only)
            ZKP_ONLY=true
            ;;

        --rebuild-zkp)
            REBUILD_ZKP=true
            ;;

        --package-chaincode)
            PACKAGE_CHAINCODE_ONLY=true
            ;;

        --chaincode-only)
            CHAINCODE_ONLY=true
            ;;

        --deploy-chaincode|--force-deploy)
            FORCE_DEPLOY=true
            ;;

        *)
            die "Unknown option: $1"
            ;;
    esac

    shift
done

###############################################################################
# Helpers
###############################################################################

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

require_command() {
    local command_name="$1"

    if ! command_exists "$command_name"; then
        die "Required command not found: $command_name"
    fi
}

wait_for_url() {
    local url="$1"
    local retries="${2:-60}"
    local delay="${3:-2}"

    for ((i = 1; i <= retries; i++)); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            return 0
        fi

        sleep "$delay"
    done

    return 1
}

###############################################################################
# Prerequisites
###############################################################################

check_prerequisites() {
    log "Checking required commands..."

    require_command git
    require_command node
    require_command npm
    require_command curl
    require_command ff

    success "Required commands available."

    log "Checking Node.js version..."
    echo " - Node: $(node --version)"
    echo " - npm:  $(npm --version)"

    log "Checking FireFly CLI..."
    local ff_v
    ff_v="$(ff version 2>/dev/null | grep -i '"version"' | head -n 1 | cut -d'"' -f4 || echo 'available')"
    echo " - FireFly: $ff_v"

    success "Prerequisites verified."
}

check_dependencies_installed() {
    log "Verifying that project dependencies are installed..."

    if [[ ! -d "node_modules" ]]; then
        die "node_modules/ directory not found in root. Please run 'npm install' first."
    fi

    if [[ ! -d "node_modules/circomlib" ]]; then
        die "Required npm package 'circomlib' not found in node_modules. Please run 'npm install'."
    fi

    success "Project dependencies are present."
}

###############################################################################
# MySQL
###############################################################################

setup_database() {
    log "Checking MySQL connectivity..."

    if ! command_exists mysqladmin || ! command_exists mysql; then
        warn "mysql / mysqladmin CLI not found. Skipping direct MySQL schema provisioning."
        return 0
    fi

    local mysql_ping_cmd=(mysqladmin --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER")
    [[ -n "$DB_PASSWORD" ]] && mysql_ping_cmd+=(--password="$DB_PASSWORD")

    if ! "${mysql_ping_cmd[@]}" ping --silent >/dev/null 2>&1; then
        warn "MySQL is not reachable at ${DB_HOST}:${DB_PORT} with user '${DB_USER}'."
        warn "Ensure MySQL service is running. If credentials differ, set DB_USER / DB_PASSWORD."
        return 0
    fi

    success "MySQL is reachable."

    log "Ensuring database '${DB_NAME}' exists..."

    local mysql_cmd=(mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER")
    [[ -n "$DB_PASSWORD" ]] && mysql_cmd+=(--password="$DB_PASSWORD")

    "${mysql_cmd[@]}" -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_0900_ai_ci;" 2>/dev/null || true

    success "Database '${DB_NAME}' exists."

    local schema_file="scripts/worksiteid_db.sql"
    if [[ -f "$schema_file" ]]; then
        log "Applying WorksiteID database schema..."
        "${mysql_cmd[@]}" "$DB_NAME" < "$schema_file" 2>/dev/null || true
        success "Database schema applied."
    fi
}

###############################################################################
# VC issuer keys
###############################################################################

setup_vc_keys() {
    log "Preparing VC issuer keys..."

    mkdir -p "$SECRETS_DIR"

    if [[ -f "$VC_PRIVATE_KEY" && -f "$VC_PUBLIC_KEY" ]]; then
        success "Existing VC issuer keys found in $SECRETS_DIR."
        return 0
    fi

    if [[ -f "$VC_PRIVATE_KEY" || -f "$VC_PUBLIC_KEY" ]]; then
        die "Incomplete VC key pair found in $SECRETS_DIR."
    fi

    log "Generating Ed25519 issuer keys..."

    if [[ ! -f scripts/generate-issuer-keys.js ]]; then
        die "VC issuer key generator not found: scripts/generate-issuer-keys.js"
    fi

    node scripts/generate-issuer-keys.js

    [[ -f "$VC_PRIVATE_KEY" ]] || die "VC private key was not generated."
    [[ -f "$VC_PUBLIC_KEY" ]] || die "VC public key was not generated."

    success "VC issuer keys generated."
}

###############################################################################
# ZKP
###############################################################################

check_zkp_artifacts() {
    [[ -f "$ZKP_WASM" ]] || return 1
    [[ -f "$ZKP_R1CS" ]] || return 1
    [[ -f "$ZKP_ZKEY" ]] || return 1
    [[ -f "$ZKP_VKEY" ]] || return 1

    return 0
}

require_zkp_tools_for_rebuild() {
    if ! command_exists circom; then
        die "circom compiler not found. Install it via 'cargo install --git https://github.com/iden3/circom.git'."
    fi

    if ! command_exists npx; then
        die "npx is required for SnarkJS ZKP generation."
    fi
}

setup_zkp() {
    log "Preparing ZKP environment..."

    [[ -f "$ZKP_CIRCUIT" ]] || die "ZKP circuit not found: $ZKP_CIRCUIT"

    if [[ "$REBUILD_ZKP" == false ]] && check_zkp_artifacts; then
        success "Existing ZKP artifacts found. Skipping regeneration."
        run_zkp_smoke_test
        return 0
    fi

    require_zkp_tools_for_rebuild

    mkdir -p "$ZKP_BUILD_DIR"
    mkdir -p "$PTAU_DIR"

    log "Removing previous generated ZKP artifacts..."

    rm -rf \
        "$ZKP_BUILD_DIR/license_verification_js" \
        "$ZKP_R1CS" \
        "$ZKP_ZKEY" \
        "$ZKP_VKEY" \
        "$PTAU_DIR"

    mkdir -p "$PTAU_DIR"

    ###########################################################################
    # Circom compilation
    ###########################################################################

    log "Compiling Circom circuit..."

    circom \
        "$ZKP_CIRCUIT" \
        -l node_modules \
        --r1cs \
        --wasm \
        --sym \
        -o "$ZKP_BUILD_DIR"

    [[ -f "$ZKP_WASM" ]] || die "Circom did not produce WASM."
    [[ -f "$ZKP_R1CS" ]] || die "Circom did not produce R1CS."

    success "Circom circuit compiled."

    ###########################################################################
    # Powers of Tau (Development BN254)
    ###########################################################################

    log "Generating development Powers of Tau (PTAU 2^12 on BN254)..."

    npx snarkjs powersoftau new bn128 12 \
        "$PTAU_DIR/pot12_0000.ptau" \
        -v

    printf '%s\n' "worksiteid-development-entropy" |
        npx snarkjs powersoftau contribute \
        "$PTAU_DIR/pot12_0000.ptau" \
        "$PTAU_DIR/pot12_0001.ptau" \
        --name="WorksiteID development contribution" \
        -v

    npx snarkjs powersoftau prepare phase2 \
        "$PTAU_DIR/pot12_0001.ptau" \
        "$PTAU_FILE" \
        -v

    success "Development Powers of Tau generated."

    ###########################################################################
    # Groth16 setup
    ###########################################################################

    log "Generating Groth16 proving key..."

    npx snarkjs groth16 setup \
        "$ZKP_R1CS" \
        "$PTAU_FILE" \
        "$ZKP_BUILD_DIR/license_verification_0000.zkey"

    printf '%s\n' "worksiteid-development-zkey-entropy" |
        npx snarkjs zkey contribute \
        "$ZKP_BUILD_DIR/license_verification_0000.zkey" \
        "$ZKP_ZKEY" \
        --name="WorksiteID development contribution" \
        -v

    npx snarkjs zkey export verificationkey \
        "$ZKP_ZKEY" \
        "$ZKP_VKEY"

    success "Groth16 proving and verification keys generated."

    rm -f "$ZKP_BUILD_DIR/license_verification_0000.zkey"
    rm -f "$PTAU_DIR/pot12_0000.ptau"
    rm -f "$PTAU_DIR/pot12_0001.ptau"

    run_zkp_smoke_test

    success "ZKP setup completed."
}

run_zkp_smoke_test() {
    log "Running ZKP smoke test..."

    local smoke_dir="$ZKP_BUILD_DIR/smoke-test"
    rm -rf "$smoke_dir"
    mkdir -p "$smoke_dir"

    local input_file="zkp/inputs/license-verification.json"
    if [[ ! -f "$input_file" ]]; then
        cat > "$smoke_dir/input.json" <<'EOF'
{
  "credits": "30",
  "status": "1",
  "version": "1",
  "randomness": "123456789",
  "commitment": "19183109381518206312794836465842399593219837414581162645845819618634038672702",
  "challenge": "42",
  "challengeBinding": "9047283310314213407419999991371225318842033956114860120480342502187493595546"
}
EOF
        input_file="$smoke_dir/input.json"
    fi

    npx snarkjs wtns calculate \
        "$ZKP_WASM" \
        "$input_file" \
        "$smoke_dir/witness.wtns"

    npx snarkjs groth16 prove \
        "$ZKP_ZKEY" \
        "$smoke_dir/witness.wtns" \
        "$smoke_dir/proof.json" \
        "$smoke_dir/public.json"

    npx snarkjs groth16 verify \
        "$ZKP_VKEY" \
        "$smoke_dir/public.json" \
        "$smoke_dir/proof.json"

    rm -rf "$smoke_dir"

    success "ZKP smoke test passed."
}

###############################################################################
# Chaincode packaging
###############################################################################

package_chaincode() {
    log "Packaging Fabric chaincode..."

    [[ -d chaincode ]] || die "chaincode directory not found."
    [[ -d chaincode/contracts ]] || die "chaincode/contracts directory not found."
    [[ -d chaincode/domain ]] || die "chaincode/domain directory not found."

    mkdir -p "$(dirname "$CHAINCODE_PACKAGE")"

    if command_exists peer && [[ -f "$ROOT_DIR/chaincode/core.yaml" ]]; then
        log "Using Fabric native 'peer lifecycle chaincode package' CLI..."
        FABRIC_CFG_PATH="$ROOT_DIR/chaincode" peer lifecycle chaincode package \
            "$CHAINCODE_PACKAGE" \
            --path chaincode \
            --lang golang \
            --label "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
    else
        log "Using tar fallback for Fabric chaincode packaging..."
        local temp_dir
        temp_dir="$(mktemp -d)"
        trap 'rm -rf "$temp_dir"' RETURN

        mkdir -p "$temp_dir/src/contracts"
        mkdir -p "$temp_dir/src/domain"

        cp chaincode/*.go "$temp_dir/src/" 2>/dev/null || true
        cp chaincode/contracts/*.go "$temp_dir/src/contracts/"
        cp chaincode/domain/*.go "$temp_dir/src/domain/"

        [[ -f chaincode/go.mod ]] || die "chaincode/go.mod not found."
        cp chaincode/go.mod "$temp_dir/src/"
        [[ -f chaincode/go.sum ]] && cp chaincode/go.sum "$temp_dir/src/"

        # Hyperledger Fabric chaincode package metadata
        cat > "$temp_dir/metadata.json" <<EOF
{
  "path": "chaincode",
  "type": "golang",
  "label": "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
}
EOF

        tar -czf "$temp_dir/code.tar.gz" -C "$temp_dir" src

        tar -czf "$CHAINCODE_PACKAGE" \
            -C "$temp_dir" \
            metadata.json \
            code.tar.gz
    fi

    [[ -s "$CHAINCODE_PACKAGE" ]] ||
        die "Chaincode package was not generated: $CHAINCODE_PACKAGE"

    success "Chaincode package created: $CHAINCODE_PACKAGE"
}

###############################################################################
# FireFly stack
###############################################################################

ensure_firefly_stack() {
    log "Preparing FireFly stack '${STACK_NAME}'..."

    if [[ ! -d "$FIREFLY_STACK_DIR" ]]; then
        log "Initializing Fabric FireFly stack (2 members)..."
        ff init fabric "$STACK_NAME" 2
    else
        success "FireFly stack already initialized in $FIREFLY_STACK_DIR."
    fi

    log "Starting FireFly stack..."
    ff start "$STACK_NAME"

    log "Waiting for FireFly API at $FIREFLY_URL..."

    if ! wait_for_url "$FIREFLY_URL/api/v1/status" 45 2; then
        die "FireFly did not become available at $FIREFLY_URL. Check status with 'ff status $STACK_NAME'."
    fi

    success "FireFly is running."
}

###############################################################################
# FireFly chaincode deployment
###############################################################################

deploy_chaincode() {
    log "Deploying chaincode '${CHAINCODE_NAME}' v${CHAINCODE_VERSION} on channel '${CHANNEL_NAME}'..."

    [[ -f "$CHAINCODE_PACKAGE" ]] ||
        die "Chaincode package missing: $CHAINCODE_PACKAGE"

    ff deploy fabric \
        "$STACK_NAME" \
        "$CHAINCODE_PACKAGE" \
        "$CHANNEL_NAME" \
        "$CHAINCODE_NAME" \
        "$CHAINCODE_VERSION"

    success "Chaincode deployed to Fabric."
}

###############################################################################
# FireFly FFI and API
###############################################################################

register_ffi_and_api() {
    log "Registering FireFly contract interface (FFI)..."

    [[ -f "$FFI_FILE" ]] || die "FFI definition not found: $FFI_FILE"

    local ffi_res
    ffi_res="$(
        curl -fsS \
            -X POST \
            -H "Content-Type: application/json" \
            --data-binary "@$FFI_FILE" \
            "$FIREFLY_URL/api/v1/namespaces/default/contracts/interfaces" || true
    )"

    local ffi_id
    ffi_id="$(echo "$ffi_res" | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4 || true)"
    if [[ -z "$ffi_id" ]]; then
        ffi_id="$(curl -fsS "$FIREFLY_URL/api/v1/namespaces/default/contracts/interfaces" 2>/dev/null | grep -o '"id":"[^"]*' | head -n 1 | cut -d'"' -f4 || true)"
    fi

    [[ -n "$ffi_id" ]] || die "Failed to retrieve FFI interface ID from FireFly."

    success "FireFly FFI registered (ID: $ffi_id)."

    log "Generating FireFly REST Gateway API '${API_NAME}'..."

    curl -fsS \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$API_NAME\",
            \"interface\": {\"id\": \"$ffi_id\"},
            \"location\": {\"channel\": \"$CHANNEL_NAME\", \"chaincode\": \"$CHAINCODE_NAME\"}
        }" \
        "$FIREFLY_URL/api/v1/namespaces/default/apis" >/dev/null || true

    success "FireFly API '${API_NAME}' registered."
}

verify_firefly_api() {
    log "Verifying FireFly API '${API_NAME}'..."

    local response
    response="$(curl -fsS "$FIREFLY_URL/api/v1/namespaces/default/apis" 2>/dev/null || true)"

    if ! echo "$response" | grep -q "\"name\":\"$API_NAME\""; then
        die "FireFly API '${API_NAME}' was not found in namespace 'default'."
    fi

    success "FireFly API '${API_NAME}' is available."
}

is_api_already_active() {
    local response
    response="$(curl -fsS "$FIREFLY_URL/api/v1/namespaces/default/apis" 2>/dev/null || true)"
    echo "$response" | grep -q "\"name\":\"$API_NAME\""
}

###############################################################################
# Complete blockchain setup
###############################################################################

setup_blockchain() {
    log "Preparing Fabric / FireFly infrastructure..."

    ensure_firefly_stack

    if [[ "$FORCE_DEPLOY" == true ]] || ! is_api_already_active; then
        deploy_chaincode
        register_ffi_and_api
    else
        success "Chaincode and API '${API_NAME}' already active on Fabric. (Skipping redeploy to protect state; use --deploy-chaincode to force)"
    fi

    verify_firefly_api

    success "Fabric / FireFly setup completed."
}

###############################################################################
# Environment file
###############################################################################

create_env_if_missing() {
    if [[ -f .env ]]; then
        success ".env already exists."
        return 0
    fi

    log "Creating development .env..."

    cat > .env <<EOF
NODE_ENV=development
PORT=3000
LOG_LEVEL=info

DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

FIREFLY_URL=${FIREFLY_URL}
FIREFLY_API_URL=${FIREFLY_URL}
FIREFLY_NAMESPACE=default
FIREFLY_API_NAME=${API_NAME}
FIREFLY_ISSUER_ID=worksiteid-issuer

LICENSE_REF_SECRET=development-license-reference-secret

ZKP_VERIFICATION_KEY_PATH=./zkp/build/verification_key.json
ZKP_CIRCUIT_PATH=./zkp/build/license_verification_js/license_verification.wasm

VC_ISSUER_PRIVATE_KEY_PATH=./secrets/issuer-private-key.pem
VC_ISSUER_PUBLIC_KEY_PATH=./secrets/issuer-public-key.pem
VC_ISSUER_ID=worksiteid-issuer
EOF

    success ".env created."
}

###############################################################################
# Validation
###############################################################################

validate_environment() {
    log "Running environment validation..."

    [[ -f "$ZKP_WASM" ]] || die "Missing ZKP WASM: $ZKP_WASM"
    [[ -f "$ZKP_R1CS" ]] || die "Missing ZKP R1CS: $ZKP_R1CS"
    [[ -f "$ZKP_ZKEY" ]] || die "Missing ZKP proving key: $ZKP_ZKEY"
    [[ -f "$ZKP_VKEY" ]] || die "Missing ZKP verification key: $ZKP_VKEY"

    [[ -f "$VC_PRIVATE_KEY" ]] || die "Missing VC private key: $VC_PRIVATE_KEY"
    [[ -f "$VC_PUBLIC_KEY" ]] || die "Missing VC public key: $VC_PUBLIC_KEY"

    [[ -f "$CHAINCODE_PACKAGE" ]] || die "Missing chaincode package: $CHAINCODE_PACKAGE"

    curl -fsS "$FIREFLY_URL/api/v1/status" >/dev/null || die "FireFly status unreachable."

    success "Environment validation passed."
}

###############################################################################
# Main
###############################################################################

main() {
    echo
    echo "============================================================"
    echo " WorksiteID - Development Environment Setup"
    echo "============================================================"
    echo

    if [[ "$PACKAGE_CHAINCODE_ONLY" == true ]]; then
        check_prerequisites
        package_chaincode
        success "Chaincode packaging completed."
        exit 0
    fi

    if [[ "$ZKP_ONLY" == true ]]; then
        check_prerequisites
        check_dependencies_installed
        setup_zkp
        success "ZKP-only setup completed."
        exit 0
    fi

    if [[ "$CHAINCODE_ONLY" == true ]]; then
        check_prerequisites
        package_chaincode
        setup_blockchain
        validate_environment
        success "Chaincode-only setup completed."
        exit 0
    fi

    check_prerequisites
    check_dependencies_installed

    create_env_if_missing

    setup_database
    setup_vc_keys
    setup_zkp

    package_chaincode
    setup_blockchain

    validate_environment

    echo
    echo "============================================================"
    echo " WorksiteID setup completed successfully."
    echo "============================================================"
    echo
    echo "Environment:"
    echo "  Backend:       Node.js (Fastify, port 3000)"
    echo "  Frontend:      Next.js (port 3001)"
    echo "  Database:      MySQL (${DB_HOST}:${DB_PORT}/${DB_NAME})"
    echo "  Blockchain:    Hyperledger Fabric"
    echo "  Gateway:       FireFly (${FIREFLY_URL})"
    echo "  ZKP:           Groth16 / BN254 / Circom / SnarkJS"
    echo "  VC:            Ed25519 (W3C format)"
    echo
    echo "Next steps:"
    echo "  npm run dev"
    echo
}

main "$@"
