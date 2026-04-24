#!/usr/bin/env bash
# =============================================================================
#  Smart Venue Experience Platform — Skills & Environment Setup
#  APL Google Cloud Challenge
# =============================================================================
#  Run this script once to install all tools, SDKs, and dependencies
#  required to build and deploy the platform.
#
#  Usage:
#    chmod +x skills.sh
#    ./skills.sh
#
#  Supports: macOS (Homebrew) · Ubuntu/Debian (apt)
# =============================================================================

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
print_banner() {
  echo ""
  echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║   Smart Venue Experience Platform — Environment Setup        ║${RESET}"
  echo -e "${BOLD}${BLUE}║   APL Google Cloud Challenge                                 ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
}

step()    { echo -e "\n${BOLD}${CYAN}▶  $1${RESET}"; }
ok()      { echo -e "   ${GREEN}✔${RESET}  $1"; }
warn()    { echo -e "   ${YELLOW}⚠${RESET}  $1"; }
info()    { echo -e "   ${DIM}ℹ  $1${RESET}"; }
fail()    { echo -e "   ${RED}✘${RESET}  $1"; }
skip()    { echo -e "   ${DIM}–  $1 (already installed)${RESET}"; }

check_cmd() { command -v "$1" &>/dev/null; }

require_version() {
  local cmd=$1 min=$2
  local current
  current=$("$cmd" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+' | head -1)
  if [[ "$(printf '%s\n' "$min" "$current" | sort -V | head -1)" == "$min" ]]; then
    return 0
  else
    return 1
  fi
}

# ── OS Detection ──────────────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) OS="macos" ;;
    Linux)
      if check_cmd apt-get; then OS="ubuntu"
      elif check_cmd yum;     then OS="rhel"
      else OS="linux"
      fi ;;
    *) echo -e "${RED}Unsupported OS: $(uname -s)${RESET}"; exit 1 ;;
  esac
}

# ── Package Manager ───────────────────────────────────────────────────────────
install_homebrew() {
  if check_cmd brew; then
    skip "Homebrew"
    brew update --quiet
  else
    step "Installing Homebrew"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    ok "Homebrew installed"
  fi
}

pkg_install() {
  local pkg=$1
  if [[ "$OS" == "macos" ]]; then
    brew install "$pkg" --quiet 2>/dev/null || true
  elif [[ "$OS" == "ubuntu" ]]; then
    sudo apt-get install -y "$pkg" -qq
  fi
}

# =============================================================================
#  SECTION 1 — CORE SYSTEM TOOLS
# =============================================================================
install_core_tools() {
  step "Core System Tools"

  # Git
  if check_cmd git; then
    skip "git $(git --version | awk '{print $3}')"
  else
    pkg_install git
    ok "git installed"
  fi

  # cURL
  if check_cmd curl; then
    skip "curl"
  else
    pkg_install curl
    ok "curl installed"
  fi

  # jq (JSON processor — used in scripts)
  if check_cmd jq; then
    skip "jq"
  else
    pkg_install jq
    ok "jq installed"
  fi

  # wget
  if ! check_cmd wget; then
    pkg_install wget && ok "wget installed"
  else
    skip "wget"
  fi

  ok "Core system tools ready"
}

# =============================================================================
#  SECTION 2 — NODE.JS (via NVM for version management)
# =============================================================================
install_node() {
  step "Node.js (via NVM)"

  local NVM_DIR="${HOME}/.nvm"
  local NODE_VERSION="20"

  # Install NVM
  if [[ -d "$NVM_DIR" ]]; then
    skip "NVM"
  else
    info "Installing NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    ok "NVM installed"
  fi

  # Load NVM
  export NVM_DIR="${HOME}/.nvm"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  # Install Node 20 LTS
  if nvm ls "$NODE_VERSION" &>/dev/null; then
    skip "Node.js $NODE_VERSION"
  else
    info "Installing Node.js $NODE_VERSION LTS..."
    nvm install "$NODE_VERSION"
    nvm alias default "$NODE_VERSION"
    ok "Node.js $NODE_VERSION installed and set as default"
  fi

  nvm use "$NODE_VERSION" --silent

  # pnpm (faster than npm, workspace support)
  if check_cmd pnpm; then
    skip "pnpm $(pnpm --version)"
  else
    npm install -g pnpm@latest --quiet
    ok "pnpm installed"
  fi

  # Turborepo (monorepo task runner)
  if check_cmd turbo; then
    skip "turbo"
  else
    npm install -g turbo@latest --quiet
    ok "Turborepo installed"
  fi

  ok "Node.js environment ready — $(node --version)"
}

# =============================================================================
#  SECTION 3 — GOOGLE CLOUD SDK
# =============================================================================
install_gcloud() {
  step "Google Cloud SDK"

  if check_cmd gcloud; then
    local version
    version=$(gcloud version 2>/dev/null | grep 'Google Cloud SDK' | awk '{print $4}')
    skip "Google Cloud SDK $version"
    gcloud components update --quiet 2>/dev/null || true
  else
    info "Installing Google Cloud SDK..."
    if [[ "$OS" == "macos" ]]; then
      brew install --cask google-cloud-sdk --quiet
    else
      # Linux install
      curl -sSL https://sdk.cloud.google.com | bash -s -- --disable-prompts
      # shellcheck disable=SC1090
      source "${HOME}/google-cloud-sdk/path.bash.inc" 2>/dev/null || true
    fi
    ok "Google Cloud SDK installed"
  fi

  # Install required gcloud components
  info "Installing gcloud components..."
  gcloud components install beta --quiet 2>/dev/null || true
  gcloud components install alpha --quiet 2>/dev/null || true
  gcloud components install cloud-firestore-emulator --quiet 2>/dev/null || true
  gcloud components install pubsub-emulator --quiet 2>/dev/null || true
  gcloud components install cloud-bigtable-emulator --quiet 2>/dev/null || true

  ok "gcloud components installed"

  # Print auth status
  if gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
    ok "gcloud authenticated as: $(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)"
  else
    warn "Not authenticated with gcloud. Run: gcloud auth login"
    warn "Then set project: gcloud config set project smart-venue-platform"
  fi
}

# =============================================================================
#  SECTION 4 — FIREBASE CLI
# =============================================================================
install_firebase() {
  step "Firebase CLI"

  if check_cmd firebase; then
    skip "Firebase CLI $(firebase --version)"
    npm install -g firebase-tools@latest --quiet
  else
    info "Installing Firebase CLI..."
    npm install -g firebase-tools@latest --quiet
    ok "Firebase CLI $(firebase --version) installed"
  fi

  # Firebase emulators (for local development)
  info "Installing Firebase emulators..."
  firebase setup:emulators:firestore --quiet 2>/dev/null || true
  firebase setup:emulators:pubsub    --quiet 2>/dev/null || true

  ok "Firebase CLI ready"
}

# =============================================================================
#  SECTION 5 — PYTHON (for Cloud Functions & scripts)
# =============================================================================
install_python() {
  step "Python 3.11+"

  if check_cmd python3 && require_version python3 "3.11"; then
    skip "Python $(python3 --version)"
  else
    if [[ "$OS" == "macos" ]]; then
      brew install python@3.11 --quiet
    else
      sudo apt-get install -y python3.11 python3.11-venv python3-pip -qq
    fi
    ok "Python installed"
  fi

  # pip & virtualenv
  if ! check_cmd pip3; then
    pkg_install python3-pip
  fi

  # pipx for isolated tool installations
  if check_cmd pipx; then
    skip "pipx"
  else
    pip3 install --user pipx --quiet
    python3 -m pipx ensurepath
    ok "pipx installed"
  fi

  ok "Python $(python3 --version) ready"
}

# =============================================================================
#  SECTION 6 — GLOBAL NPM PACKAGES (Dev Tools)
# =============================================================================
install_global_npm_packages() {
  step "Global NPM Dev Tools"

  local packages=(
    "typescript"              # TypeScript compiler
    "ts-node"                 # TypeScript Node runner
    "tsx"                     # Fast TypeScript executor
    "next"                    # Next.js framework
    "@anthropic-ai/sdk"       # Claude API SDK
    "eslint"                  # Linter
    "prettier"                # Code formatter
    "jest"                    # Unit testing
    "k6"                      # Load testing
    "artillery"               # Load testing alternative
    "nodemon"                 # Auto-restart dev server
    "concurrently"            # Run multiple commands
    "dotenv-cli"              # Load .env files in scripts
    "zod"                     # Schema validation
  )

  for pkg in "${packages[@]}"; do
    if npm list -g "$pkg" --depth=0 &>/dev/null 2>&1; then
      skip "$pkg"
    else
      npm install -g "$pkg" --quiet --no-audit 2>/dev/null && ok "$pkg"
    fi
  done

  ok "Global NPM packages ready"
}

# =============================================================================
#  SECTION 7 — PROJECT STRUCTURE SCAFFOLD
# =============================================================================
scaffold_project() {
  step "Scaffolding Project Structure"

  local ROOT
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  # Top-level config files
  create_if_missing() {
    local path="$1"
    local dir
    dir=$(dirname "$path")
    mkdir -p "$dir"
    if [[ ! -f "$path" ]]; then
      touch "$path"
      info "Created: $path"
    fi
  }

  # Directory structure
  local dirs=(
    "$ROOT/apps/web/src/app"
    "$ROOT/apps/web/src/components/ui"
    "$ROOT/apps/web/src/components/venue"
    "$ROOT/apps/web/src/hooks"
    "$ROOT/apps/web/src/lib"
    "$ROOT/apps/web/src/types"
    "$ROOT/apps/web/public/icons"
    "$ROOT/functions/src/handlers"
    "$ROOT/functions/src/lib"
    "$ROOT/functions/src/types"
    "$ROOT/functions/tests"
    "$ROOT/scripts/simulators"
    "$ROOT/scripts/seed"
    "$ROOT/infra/terraform"
    "$ROOT/infra/firestore"
    "$ROOT/infra/bigquery"
    "$ROOT/docs"
  )

  for dir in "${dirs[@]}"; do
    mkdir -p "$dir"
  done

  ok "Directory structure created"

  # Root package.json (monorepo)
  if [[ ! -f "$ROOT/package.json" ]]; then
    cat > "$ROOT/package.json" << 'EOF'
{
  "name": "smart-venue-platform",
  "private": true,
  "workspaces": ["apps/*", "functions"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "deploy:functions": "cd functions && npm run deploy",
    "deploy:web": "cd apps/web && npm run deploy",
    "simulate": "tsx scripts/simulators/run-all.ts",
    "seed": "tsx scripts/seed/seed-firestore.ts",
    "emulate": "firebase emulators:start"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "prettier": "^3.2.0",
    "eslint": "^9.0.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
EOF
    ok "Root package.json created"
  else
    skip "package.json"
  fi

  # Root tsconfig.json
  if [[ ! -f "$ROOT/tsconfig.json" ]]; then
    cat > "$ROOT/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", ".next"]
}
EOF
    ok "tsconfig.json created"
  fi

  # .gitignore
  if [[ ! -f "$ROOT/.gitignore" ]]; then
    cat > "$ROOT/.gitignore" << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
.next/
dist/
out/
build/

# Environment
.env
.env.local
.env.production
*.local

# GCP / Firebase
serviceAccountKey.json
.firebaserc
*-key.json
*.credentials.json

# Terraform
infra/terraform/.terraform/
infra/terraform/terraform.tfstate
infra/terraform/terraform.tfstate.backup
infra/terraform/*.tfvars

# Testing
coverage/
.nyc_output/

# Misc
.DS_Store
*.log
.turbo/
EOF
    ok ".gitignore created"
  fi

  # .env.local.example
  if [[ ! -f "$ROOT/.env.local.example" ]]; then
    cat > "$ROOT/.env.local.example" << 'EOF'
# ─── Google Cloud ──────────────────────────────────────────
GCP_PROJECT_ID=smart-venue-platform
GCP_REGION=us-central1

# ─── Firebase ──────────────────────────────────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

# ─── Google Maps ───────────────────────────────────────────
NEXT_PUBLIC_MAPS_API_KEY=

# ─── Pub/Sub Topics ────────────────────────────────────────
PUBSUB_ENTRY_TOPIC=venue-entry-events
PUBSUB_POS_TOPIC=venue-pos-events
PUBSUB_SENSOR_TOPIC=venue-sensor-events
PUBSUB_STAFF_TOPIC=venue-staff-events

# ─── BigQuery ──────────────────────────────────────────────
BQ_DATASET=venue_analytics

# ─── Thresholds ────────────────────────────────────────────
ZONE_WARN_THRESHOLD=70
ZONE_CRITICAL_THRESHOLD=85
QUEUE_ALERT_MINUTES=15
EOF
    ok ".env.local.example created"
  fi

  # Firebase config
  if [[ ! -f "$ROOT/firebase.json" ]]; then
    cat > "$ROOT/firebase.json" << 'EOF'
{
  "firestore": {
    "rules": "infra/firestore/firestore.rules",
    "indexes": "infra/firestore/firestore.indexes.json"
  },
  "hosting": {
    "public": "apps/web/out",
    "cleanUrls": true,
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "max-age=31536000" }]
      },
      {
        "source": "**",
        "headers": [
          { "key": "X-Frame-Options", "value": "SAMEORIGIN" },
          { "key": "X-Content-Type-Options", "value": "nosniff" }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  },
  "emulators": {
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting":   { "port": 5000 },
    "pubsub":    { "port": 8085 },
    "ui":        { "enabled": true, "port": 4000 }
  }
}
EOF
    ok "firebase.json created"
  fi

  # Firestore security rules
  if [[ ! -f "$ROOT/infra/firestore/firestore.rules" ]]; then
    cat > "$ROOT/infra/firestore/firestore.rules" << 'EOF'
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read for venue data (zones, queues, alerts, sessions)
    match /zones/{zoneId} {
      allow read: if true;
      allow write: if false; // Cloud Functions only
    }
    match /queues/{queueId} {
      allow read: if true;
      allow write: if false;
    }
    match /alerts/{alertId} {
      allow read: if true;
      allow write: if false;
    }
    match /sessions/{sessionId} {
      allow read: if true;
      allow write: if false;
    }
    // All other documents: deny by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
EOF
    ok "Firestore security rules created"
  fi

  # Firestore indexes placeholder
  if [[ ! -f "$ROOT/infra/firestore/firestore.indexes.json" ]]; then
    cat > "$ROOT/infra/firestore/firestore.indexes.json" << 'EOF'
{
  "indexes": [
    {
      "collectionGroup": "alerts",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "zone",        "order": "ASCENDING" },
        { "fieldPath": "triggeredAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "queues",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "zone",       "order": "ASCENDING" },
        { "fieldPath": "updatedAt",  "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
EOF
    ok "Firestore indexes created"
  fi

  # Functions package.json
  if [[ ! -f "$ROOT/functions/package.json" ]]; then
    cat > "$ROOT/functions/package.json" << 'EOF'
{
  "name": "venue-functions",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build":  "tsc",
    "watch":  "tsc --watch",
    "serve":  "npm run build && firebase emulators:start --only functions",
    "deploy": "npm run build && firebase deploy --only functions",
    "test":   "jest --coverage"
  },
  "main": "dist/index.js",
  "engines": { "node": "20" },
  "dependencies": {
    "firebase-admin":    "^12.0.0",
    "firebase-functions": "^5.0.0",
    "@google-cloud/pubsub":  "^4.0.0",
    "@google-cloud/bigquery": "^7.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript":        "^5.4.0",
    "ts-jest":           "^29.0.0",
    "jest":              "^29.0.0",
    "@types/node":       "^20.0.0",
    "firebase-functions-test": "^3.0.0"
  }
}
EOF
    ok "functions/package.json created"
  fi

  # Functions tsconfig
  if [[ ! -f "$ROOT/functions/tsconfig.json" ]]; then
    cat > "$ROOT/functions/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "outDir": "dist",
    "sourceMap": true,
    "strict": true,
    "target": "es2022",
    "lib": ["es2022"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
EOF
    ok "functions/tsconfig.json created"
  fi

  # Functions entry point
  if [[ ! -f "$ROOT/functions/src/index.ts" ]]; then
    cat > "$ROOT/functions/src/index.ts" << 'EOF'
import * as functions from 'firebase-functions/v2';

// ── Event Processors ──────────────────────────────────────
export { processEntryEvent }  from './handlers/processEntryEvent';
export { processPosEvent }    from './handlers/processPosEvent';
export { processSensorEvent } from './handlers/processSensorEvent';

// ── Scheduled Jobs ────────────────────────────────────────
export { evaluateZoneThresholds } from './handlers/evaluateZoneThresholds';
export { aggregateSessionMetrics } from './handlers/aggregateSessionMetrics';

// ── Firestore Triggers ────────────────────────────────────
export { dispatchFcmNotification } from './handlers/dispatchFcmNotification';
EOF
    ok "functions/src/index.ts created"
  fi

  # Turbo config
  if [[ ! -f "$ROOT/turbo.json" ]]; then
    cat > "$ROOT/turbo.json" << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    }
  }
}
EOF
    ok "turbo.json created"
  fi

  # Prettier config
  if [[ ! -f "$ROOT/.prettierrc" ]]; then
    cat > "$ROOT/.prettierrc" << 'EOF'
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true
}
EOF
    ok ".prettierrc created"
  fi

  # ESLint config
  if [[ ! -f "$ROOT/eslint.config.js" ]]; then
    cat > "$ROOT/eslint.config.js" << 'EOF'
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
EOF
    ok "eslint.config.js created"
  fi

  # Demo simulator script
  if [[ ! -f "$ROOT/scripts/simulators/run-all.ts" ]]; then
    cat > "$ROOT/scripts/simulators/run-all.ts" << 'EOF'
/**
 * Master simulator runner — publishes realistic venue events to Pub/Sub.
 * Runs all three simulators concurrently for a full demo scenario.
 *
 * Usage: pnpm simulate
 */
import { spawn } from 'child_process';
import * as path from 'path';

const simulators = ['simulate-entries', 'simulate-pos', 'simulate-sensors'];

console.log('🏟️  Starting Smart Venue simulators...\n');

simulators.forEach((sim) => {
  const child = spawn('tsx', [path.join(__dirname, `${sim}.ts`)], {
    stdio: 'inherit',
    env: { ...process.env },
  });
  child.on('error', (err) => console.error(`[${sim}] Error:`, err));
});
EOF
    ok "scripts/simulators/run-all.ts created"
  fi

  ok "Project structure scaffolded"
}

# =============================================================================
#  SECTION 8 — GCP CONFIGURATION
# =============================================================================
configure_gcp() {
  step "GCP Configuration"

  local PROJECT_ID="smart-venue-platform"

  if check_cmd gcloud && gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
    info "Setting active GCP project to: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID" 2>/dev/null && ok "GCP project set: $PROJECT_ID" || warn "Could not set project — run manually: gcloud config set project $PROJECT_ID"

    info "Enabling required APIs (this may take 1–2 minutes)..."
    local APIS=(
      "pubsub.googleapis.com"
      "cloudfunctions.googleapis.com"
      "firestore.googleapis.com"
      "bigquery.googleapis.com"
      "firebase.googleapis.com"
      "maps-backend.googleapis.com"
      "maps-javascript-api.googleapis.com"
      "secretmanager.googleapis.com"
      "cloudbuild.googleapis.com"
      "cloudscheduler.googleapis.com"
      "iam.googleapis.com"
      "run.googleapis.com"
      "artifactregistry.googleapis.com"
      "eventarc.googleapis.com"
    )

    for api in "${APIS[@]}"; do
      gcloud services enable "$api" --project="$PROJECT_ID" 2>/dev/null && \
        ok "Enabled: $api" || warn "Could not enable $api — check billing"
    done
  else
    warn "GCP not authenticated. Skipping API enablement."
    warn "After auth, run: gcloud services enable pubsub.googleapis.com cloudfunctions.googleapis.com firestore.googleapis.com bigquery.googleapis.com"
  fi
}

# =============================================================================
#  SECTION 9 — INSTALL PROJECT DEPENDENCIES
# =============================================================================
install_project_deps() {
  step "Installing Project Dependencies"

  local ROOT
  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

  if [[ -f "$ROOT/package.json" ]] && check_cmd pnpm; then
    info "Running pnpm install..."
    cd "$ROOT"
    pnpm install --frozen-lockfile 2>/dev/null || pnpm install
    ok "Project dependencies installed"
  else
    warn "No package.json found or pnpm not available — skipping dependency install"
  fi
}

# =============================================================================
#  SECTION 10 — VERIFICATION
# =============================================================================
verify_installation() {
  step "Verification — Installed Versions"

  echo ""
  echo -e "  ${BOLD}Tool                  Version${RESET}"
  echo -e "  ${DIM}──────────────────────────────────────────${RESET}"

  verify_tool() {
    local name=$1 cmd=$2 version_flag=${3:---version}
    if check_cmd "$cmd"; then
      local ver
      ver=$("$cmd" $version_flag 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
      printf "  ${GREEN}✔${RESET}  %-22s ${CYAN}%s${RESET}\n" "$name" "$ver"
    else
      printf "  ${RED}✘${RESET}  %-22s ${RED}NOT FOUND${RESET}\n" "$name"
    fi
  }

  verify_tool "Node.js"           "node"     "--version"
  verify_tool "pnpm"              "pnpm"     "--version"
  verify_tool "TypeScript"        "tsc"      "--version"
  verify_tool "Turborepo"         "turbo"    "--version"
  verify_tool "Firebase CLI"      "firebase" "--version"
  verify_tool "Google Cloud SDK"  "gcloud"   "version"
  verify_tool "Python 3"          "python3"  "--version"
  verify_tool "Git"               "git"      "--version"
  verify_tool "jq"                "jq"       "--version"

  echo ""
}

# =============================================================================
#  SECTION 11 — NEXT STEPS SUMMARY
# =============================================================================
print_next_steps() {
  echo ""
  echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${GREEN}║   ✅  Setup Complete — You're ready to build!                ║${RESET}"
  echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${RESET}"
  echo ""
  echo -e "${BOLD}Next Steps:${RESET}"
  echo ""
  echo -e "  ${CYAN}1.${RESET} Authenticate with GCP:"
  echo -e "     ${DIM}gcloud auth login${RESET}"
  echo -e "     ${DIM}gcloud auth application-default login${RESET}"
  echo ""
  echo -e "  ${CYAN}2.${RESET} Authenticate with Firebase:"
  echo -e "     ${DIM}firebase login${RESET}"
  echo ""
  echo -e "  ${CYAN}3.${RESET} Copy and fill in environment variables:"
  echo -e "     ${DIM}cp .env.local.example apps/web/.env.local${RESET}"
  echo -e "     ${DIM}cp .env.local.example functions/.env${RESET}"
  echo ""
  echo -e "  ${CYAN}4.${RESET} Start local development with Firebase Emulators:"
  echo -e "     ${DIM}pnpm emulate${RESET}"
  echo ""
  echo -e "  ${CYAN}5.${RESET} Start PWA dev server:"
  echo -e "     ${DIM}pnpm dev${RESET}"
  echo ""
  echo -e "  ${CYAN}6.${RESET} Run data simulators (for demo data):"
  echo -e "     ${DIM}pnpm simulate${RESET}"
  echo ""
  echo -e "  ${CYAN}7.${RESET} Deploy to production:"
  echo -e "     ${DIM}pnpm deploy:functions && pnpm deploy:web${RESET}"
  echo ""
  echo -e "  ${DIM}📋 Full task list:  tasks.md${RESET}"
  echo -e "  ${DIM}📐 Architecture:    diagrams/architecture.html${RESET}"
  echo -e "  ${DIM}🔄 Workflow:        diagrams/workflow.html${RESET}"
  echo ""
  echo -e "  ${BOLD}${YELLOW}Build something award-winning. 🏆${RESET}"
  echo ""
}

# =============================================================================
#  MAIN
# =============================================================================
main() {
  print_banner
  detect_os

  info "Detected OS: $OS"

  # macOS: ensure Homebrew first
  [[ "$OS" == "macos" ]] && install_homebrew

  install_core_tools
  install_node
  install_gcloud
  install_firebase
  install_python
  install_global_npm_packages
  scaffold_project
  configure_gcp
  install_project_deps
  verify_installation
  print_next_steps
}

main "$@"
