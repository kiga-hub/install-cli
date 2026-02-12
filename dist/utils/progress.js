export function computeOverallPercent(totalWeight, completedWeight, currentWeight, stepPercent) {
    if (totalWeight <= 0) {
        return 0;
    }
    const clamped = Math.min(100, Math.max(0, stepPercent));
    const progressWeight = (currentWeight * clamped) / 100;
    const overall = ((completedWeight + progressWeight) / totalWeight) * 100;
    return Math.min(100, Math.max(0, Math.round(overall)));
}
