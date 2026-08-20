export function isHumanLeverageOwner(email: string | null | undefined): boolean {
  if (!email) return false

  const configured = process.env.HUMAN_LEVERAGE_OWNER_EMAILS ?? ''
  const allowedEmails = configured
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  return allowedEmails.includes(email.trim().toLowerCase())
}
