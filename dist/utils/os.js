import { readFileSync } from "node:fs";
export function detectOS() {
    const platform = process.platform;
    if (platform === "darwin") {
        return "macos";
    }
    if (platform === "win32") {
        return "windows";
    }
    if (platform === "linux") {
        try {
            const osRelease = readFileSync("/etc/os-release", "utf-8");
            const lowerRelease = osRelease.toLowerCase();
            if (lowerRelease.includes('id="centos"') || lowerRelease.includes("id_like=\"rhel\"") || lowerRelease.includes("centos")) {
                return "centos";
            }
            if (lowerRelease.includes('id="ubuntu"') || lowerRelease.includes("id=ubuntu")) {
                return "ubuntu";
            }
            if (lowerRelease.includes('id="debian"') || lowerRelease.includes("id=debian") || lowerRelease.includes("id_like=\"debian\"")) {
                return "debian";
            }
        }
        catch {
            // Fallback to checking /etc/redhat-release for CentOS/RHEL
            try {
                const redhatRelease = readFileSync("/etc/redhat-release", "utf-8");
                if (redhatRelease.toLowerCase().includes("centos")) {
                    return "centos";
                }
                if (redhatRelease.toLowerCase().includes("red hat") || redhatRelease.toLowerCase().includes("rhel")) {
                    return "centos";
                }
            }
            catch {
                // Ignore
            }
        }
        return "unknown";
    }
    return "unknown";
}
export function getInstallCommand(os, packageName) {
    switch (os) {
        case "centos":
            return `yum install -y ${packageName}`;
        case "ubuntu":
        case "debian":
            if (packageName === "nushell") {
                return `export PREFIX=/usr/local && curl -fsSL https://nushell.sh/install.sh | bash`;
            }
            return `apt-get install -y ${packageName}`;
        case "macos":
            return `brew install ${packageName}`;
        case "windows":
            return `choco install -y ${packageName}`;
        default:
            return `echo "Unsupported OS" && exit 1`;
    }
}
export function getPackageManagerCommand(os) {
    switch (os) {
        case "centos":
            return "yum";
        case "ubuntu":
        case "debian":
            return "apt-get";
        case "macos":
            return "brew";
        case "windows":
            return "choco";
        default:
            return "unknown";
    }
}
export function isPackageInstalled(os, packageName) {
    switch (os) {
        case "centos":
            return `rpm -q ${packageName}`;
        case "ubuntu":
        case "debian":
            return `dpkg -l | grep -q ${packageName}`;
        case "macos":
            return `brew list ${packageName}`;
        case "windows":
            return `choco list -l | findstr /c:${packageName}`;
        default:
            return "echo unsupported";
    }
}
export function getOSDisplayName(os) {
    switch (os) {
        case "centos":
            return "CentOS";
        case "ubuntu":
            return "Ubuntu";
        case "debian":
            return "Debian";
        case "macos":
            return "macOS";
        case "windows":
            return "Windows";
        default:
            return "Unknown OS";
    }
}
export function getPackageManager(os) {
    switch (os) {
        case "centos":
            return "yum";
        case "ubuntu":
        case "debian":
            return "apt";
        case "macos":
            return "brew";
        case "windows":
            return "choco";
        default:
            return "unknown";
    }
}
