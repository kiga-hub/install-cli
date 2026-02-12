#!/bin/bash
set -e

REPO_URL="https://github.com/anomalyco/installer-cli.git"
INSTALL_SCRIPT="npm run dev -- install --config config/steps.json --verbose"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}        ${GREEN}OpenInstall - CLI Installer${NC}                    ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}✖${NC} Please run as root (use sudo)"
    exit 1
fi

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
            apt-get install -y nodejs > /dev/null 2>&1
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
            apt-get update -qq > /dev/null 2>&1
            apt-get install -y git > /dev/null 2>&1
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
print_step "Cloning installer-cli..."
TEMP_DIR=$(mktemp -d)
git clone --depth 1 "$REPO_URL" "$TEMP_DIR" 2>/dev/null || {
    print_error "Failed to clone repository"
    print_info "Trying alternative method..."
    
    cd "$TEMP_DIR"
    curl -fsSL "$REPO_URL" -o repo.tar.gz 2>/dev/null || wget -q "$REPO_URL" -O repo.tar.gz 2>/dev/null || {
        print_error "Could not download repository"
        rm -rf "$TEMP_DIR"
        exit 1
    }
    tar -xzf repo.tar.gz --strip-components=1 2>/dev/null || true
}

cd "$TEMP_DIR"
echo ""

print_step "Installing dependencies..."
npm install 2>&1 | while IFS= read -r line; do
    echo -e "  ${YELLOW}ℹ${NC} ${line:0:80}"
done

echo ""
print_success "Dependencies installed"
echo ""

# Run the installer
print_step "Running installer..."
echo -e "${CYAN}────────────────────────────────────────────────────────${NC}"
echo ""

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
