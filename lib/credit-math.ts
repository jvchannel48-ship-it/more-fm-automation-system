export function spendCredits(dailyCredits: number, bonusCredits: number, cost = 20) {
  if (!Number.isInteger(dailyCredits) || dailyCredits < 0 || !Number.isInteger(bonusCredits) || bonusCredits < 0 || !Number.isInteger(cost) || cost < 1) {
    throw new RangeError('Credit amounts and cost must be non-negative integers, with a positive cost.')
  }
  const creditsRemaining = dailyCredits + bonusCredits
  if (creditsRemaining < cost) return { accepted: false as const, dailyCredits, bonusCredits, creditsRemaining }
  const dailyDebited = Math.min(dailyCredits, cost)
  const bonusDebited = cost - dailyDebited
  const nextDailyCredits = dailyCredits - dailyDebited
  const nextBonusCredits = bonusCredits - bonusDebited
  return {
    accepted: true as const,
    dailyCredits: nextDailyCredits,
    bonusCredits: nextBonusCredits,
    creditsRemaining: nextDailyCredits + nextBonusCredits,
  }
}

export function needsManilaDailyReset(creditDate: string, today: string) {
  return creditDate < today
}
