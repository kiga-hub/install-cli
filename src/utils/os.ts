import { readFileSync } from "node:fs";

export type OS = "centos" | "ubuntu" | "debian" | "macos" | "windows" | "unknown";

export function detectOS(): OS {
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
    } catch {
      // Fallback to checking /etc/redhat-release for CentOS/RHEL
      try {
        const redhatRelease = readFileSync("/etc/redhat-release", "utf-8");
        if (redhatRelease.toLowerCase().includes("centos")) {
          return "centos";
        }
        if (redhatRelease.toLowerCase().includes("red hat") || redhatRelease.toLowerCase().includes("rhel")) {
          return "centos";
        }
      } catch {
        // Ignore
      }
    }
    
    return "unknown";
  }
  
  return "unknown";
}

export function getInstallCommand(os: OS, packageName: string): string {
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

export function getPackageManagerCommand(os: OS): string {
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

export function isPackageInstalled(os: OS, packageName: string): string {
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

export function getOSDisplayName(os: OS): string {
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

export function getPackageManager(os: OS): string {
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
