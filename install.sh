#!/bin/bash
set -e

REPO_URL="https://github.com/kiga-hub/install-cli.git"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✖${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Re-run with sudo if not root and has sudo access
if [ "$EUID" -ne 0 ]; then
    if sudo -n true 2>/dev/null; then
        # Has passwordless sudo, re-execute
        exec sudo "$0" "$@"
        exit 0
    else
        print_error "This script requires root privileges"
        echo ""
        print_info "Please run with sudo:"
        echo "  curl -fsSL https://raw.githubusercontent.com/kiga-hub/install-cli/master/install.sh | sudo bash"
        exit 1
    fi
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}        ${GREEN}OpenInstall - CLI Installer${NC}                    ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
print_step "Detecting OS..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="$NAME"
    OS_ID="$ID"
else
    OS_NAME="Unknown"
    OS_ID="unknown"
fi
print_success "OS: $OS_NAME"
echo ""

# Install Node.js if not present
print_step "Checking Node.js..."
if ! command -v node &> /dev/null; then
    print_info "Node.js not found, installing..."
    
    case "$OS_ID" in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - > /dev/null 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs > /dev/null 2>&1
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_lts.x | bash - > /dev/null 2>&1
            yum install -y nodejs > /dev/null 2>&1 || dnf install -y nodejs > /dev/null 2>&1
            ;;
        alpine)
            apk add --no-cache nodejs npm
            ;;
        *)
            print_error "Unsupported OS: $OS_ID"
            print_info "Please install Node.js manually: https://nodejs.org/"
            exit 1
            ;;
    esac
    print_success "Node.js installed"
else
    print_success "Node.js found: $(node --version)"
fi

# Install git if not present
print_step "Checking git..."
if ! command -v git &> /dev/null; then
    print_info "git not found, installing..."
    case "$OS_ID" in
        ubuntu|debian)
            DEBIAN_FRONTEND=noninteractive apt-get update -qq > /dev/null 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git > /dev/null 2>&1
            ;;
        centos|rhel|fedora)
            yum install -y git > /dev/null 2>&1 || dnf install -y git > /dev/null 2>&1
            ;;
        alpine)
            apk add --no-cache git
            ;;
    esac
    print_success "git installed"
else
    print_success "git found: $(git --version)"
fi

echo ""
print_step "Cloning install-cli..."
TEMP_DIR=$(mktemp -d)
git clone --depth 1 "$REPO_URL" "$TEMP_DIR" 2>/dev/null || {
    print_error "Failed to clone repository"
    cd "$TEMP_DIR"
    curl -fsSL "$REPO_URL" -o repo.tar.gz 2>/dev/null || {
        print_error "Could not download repository"
        rm -rf "$TEMP_DIR"
        exit 1
    }
    tar -xzf repo.tar.gz --strip-components=1 2>/dev/null || true
}

cd "$TEMP_DIR"
echo ""

print_step "Installing dependencies..."
npm install --silent 2>&1 | grep -v "^$" | while IFS= read -r line; do
    [ -n "$line" ] && echo -e "  ${YELLOW}ℹ${NC} ${line:0:80}"
done 2>/dev/null || true

echo ""
print_success "Dependencies installed"
echo ""

# Run the installer
print_step "Running installer..."
echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"
echo ""

# Auto-advance in non-interactive mode
export CLI_PROMPT_CHOICE="next"
npm run dev -- install --config config/steps.json --verbose

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    print_success "Installation completed!"
else
    print_error "Installation failed with exit code: $EXIT_CODE"
fi

# Cleanup
cd /
rm -rf "$TEMP_DIR"

exit $EXIT_CODE
