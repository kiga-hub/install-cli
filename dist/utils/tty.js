export function isTTY() {
    return Boolean(process.stdout.isTTY);
}
