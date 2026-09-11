// Plain-language names for backend states. Tones map to .status--{tone}.
export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'neutral';

interface StatusInfo {
  label: string;
  tone: Tone;
  live?: boolean;
}

const STATUS: Record<string, StatusInfo> = {
  // crypto deposits
  'deposit:Pending': { label: 'Confirming', tone: 'info', live: true },
  'deposit:Credited': { label: 'Credited', tone: 'ok' },
  'deposit:Rejected': { label: 'Rejected', tone: 'bad' },
  // crypto withdrawals
  'cryptoWithdrawal:PendingReview': { label: 'In review', tone: 'warn' },
  'cryptoWithdrawal:Approved': { label: 'Queued', tone: 'info', live: true },
  'cryptoWithdrawal:Broadcasting': { label: 'Sending', tone: 'info', live: true },
  'cryptoWithdrawal:Broadcast': { label: 'Sent, confirming', tone: 'info', live: true },
  'cryptoWithdrawal:Confirmed': { label: 'Completed', tone: 'ok' },
  'cryptoWithdrawal:Rejected': { label: 'Rejected', tone: 'bad' },
  'cryptoWithdrawal:Cancelled': { label: 'Cancelled', tone: 'neutral' },
  'cryptoWithdrawal:Failed': { label: 'Failed, refunded', tone: 'bad' },
  'cryptoWithdrawal:NeedsAttention': { label: 'Delayed', tone: 'warn' },
  // fiat deposits
  'fiatDeposit:Initiated': { label: 'Awaiting payment', tone: 'warn' },
  'fiatDeposit:Succeeded': { label: 'Credited', tone: 'ok' },
  'fiatDeposit:Failed': { label: 'Failed', tone: 'bad' },
  'fiatDeposit:Abandoned': { label: 'Abandoned', tone: 'neutral' },
  // fiat withdrawals
  'fiatWithdrawal:PendingReview': { label: 'In review', tone: 'warn' },
  'fiatWithdrawal:Approved': { label: 'Queued', tone: 'info', live: true },
  'fiatWithdrawal:Processing': { label: 'Sending to bank', tone: 'info', live: true },
  'fiatWithdrawal:Succeeded': { label: 'Paid out', tone: 'ok' },
  'fiatWithdrawal:Failed': { label: 'Failed, refunded', tone: 'bad' },
  'fiatWithdrawal:Reversed': { label: 'Reversed, refunded', tone: 'bad' },
  'fiatWithdrawal:Rejected': { label: 'Rejected', tone: 'bad' },
  'fiatWithdrawal:Cancelled': { label: 'Cancelled', tone: 'neutral' },
  'fiatWithdrawal:NeedsAttention': { label: 'Delayed', tone: 'warn' },
  // kyc
  'kyc:Pending': { label: 'In review', tone: 'warn' },
  'kyc:Approved': { label: 'Approved', tone: 'ok' },
  'kyc:Rejected': { label: 'Rejected', tone: 'bad' },
  // p2p orders
  'p2pOrder:PendingPayment': { label: 'Awaiting payment', tone: 'warn', live: true },
  'p2pOrder:Paid': { label: 'Paid, awaiting release', tone: 'info', live: true },
  'p2pOrder:Completed': { label: 'Completed', tone: 'ok' },
  'p2pOrder:Cancelled': { label: 'Cancelled', tone: 'neutral' },
  'p2pOrder:Expired': { label: 'Expired', tone: 'neutral' },
  'p2pOrder:Disputed': { label: 'In dispute', tone: 'bad' },
  'p2pOrder:ResolvedToBuyer': { label: 'Resolved for buyer', tone: 'ok' },
  'p2pOrder:ResolvedToSeller': { label: 'Resolved for seller', tone: 'ok' },
  // p2p ads
  'ad:Active': { label: 'Live', tone: 'ok' },
  'ad:Paused': { label: 'Paused', tone: 'warn' },
  'ad:Closed': { label: 'Closed', tone: 'neutral' },
  // disputes
  'dispute:Open': { label: 'Open', tone: 'bad' },
  'dispute:ResolvedToBuyer': { label: 'Released to buyer', tone: 'ok' },
  'dispute:ResolvedToSeller': { label: 'Returned to seller', tone: 'ok' },
  // aml
  'alert:Open': { label: 'Open', tone: 'warn' },
  'alert:Dismissed': { label: 'Dismissed', tone: 'neutral' },
  'alert:Confirmed': { label: 'Confirmed', tone: 'bad' },
  // users
  'user:Active': { label: 'Active', tone: 'ok' },
  'user:Frozen': { label: 'Frozen', tone: 'bad' },
  'user:Closed': { label: 'Closed', tone: 'neutral' },
};

export type StatusKind =
  | 'deposit'
  | 'cryptoWithdrawal'
  | 'fiatDeposit'
  | 'fiatWithdrawal'
  | 'kyc'
  | 'p2pOrder'
  | 'ad'
  | 'dispute'
  | 'alert'
  | 'user';

export function statusInfo(kind: StatusKind, status: string): StatusInfo {
  return STATUS[`${kind}:${status}`] ?? { label: status.replace(/([a-z])([A-Z])/g, '$1 $2'), tone: 'neutral' };
}

const JOURNAL: Record<string, string> = {
  crypto_deposit: 'Deposit',
  crypto_withdrawal_hold: 'Withdrawal',
  crypto_withdrawal_settle: 'Withdrawal sent',
  crypto_withdrawal_release: 'Withdrawal refunded',
  network_fee: 'Network fee',
  fiat_deposit: 'Naira deposit',
  fiat_withdrawal_hold: 'Naira withdrawal',
  fiat_withdrawal_settle: 'Naira withdrawal paid',
  fiat_withdrawal_release: 'Naira withdrawal refunded',
  fiat_withdrawal_reversal: 'Naira withdrawal reversed',
  trade_buy: 'Buy',
  trade_sell: 'Sell',
  trade_swap: 'Swap',
  p2p_ad_reserve: 'P2P ad reserve',
  p2p_ad_release: 'P2P ad release',
  p2p_escrow_lock: 'P2P escrow',
  p2p_escrow_release: 'P2P trade settled',
  p2p_escrow_refund: 'P2P escrow returned',
  admin_adjustment: 'Balance adjustment',
  treasury_funding: 'Treasury funding',
  treasury_defunding: 'Treasury withdrawal',
};

export function journalLabel(type: string): string {
  return JOURNAL[type] ?? type.replace(/_/g, ' ');
}

const AML_RULES: Record<string, { name: string; description: string }> = {
  large_withdrawal: { name: 'Large withdrawal', description: 'A single withdrawal above the naira threshold.' },
  withdrawal_velocity: { name: 'Withdrawal velocity', description: 'Too many withdrawals, or too much value, inside the window.' },
  new_device_withdrawal: { name: 'New device withdrawal', description: 'Withdrawal soon after signing in from a new device.' },
  rapid_in_out: { name: 'Rapid in and out', description: 'Most of a recent deposit leaves again within the window.' },
  new_withdrawal_address: { name: 'New withdrawal address', description: 'First withdrawal to an address, above the threshold.' },
  structuring: { name: 'Structuring', description: 'Several withdrawals just under the review threshold.' },
  large_deposit: { name: 'Large deposit', description: 'A single deposit above the naira threshold.' },
  large_p2p_order: { name: 'Large P2P order', description: 'A P2P order above the naira threshold.' },
  p2p_velocity: { name: 'P2P velocity', description: 'Unusually many P2P orders inside the window.' },
  failed_login_burst: { name: 'Failed sign-in burst', description: 'Repeated failed sign-ins inside the window.' },
  blocked_address: { name: 'Blocked address', description: 'Withdrawal to an address on the internal block list.' },
  sanctioned_address: { name: 'Sanctioned address', description: 'Withdrawal to an address flagged by the sanctions oracle.' },
};

export function amlRule(code: string): { name: string; description: string } {
  return AML_RULES[code] ?? { name: code.replace(/_/g, ' '), description: '' };
}

const ACTIVITY: Record<string, string> = {
  'auth.register': 'Account created',
  'auth.email_confirmed': 'Email confirmed',
  'auth.login_succeeded': 'Signed in',
  'auth.login_failed': 'Failed sign-in attempt',
  'auth.logout': 'Signed out',
  'auth.refresh_token_reuse': 'Session ended after token reuse',
  'security.password_changed': 'Password changed',
  'security.password_reset': 'Password reset',
  'security.2fa_enabled': 'Two-factor authentication turned on',
  'security.2fa_disabled': 'Two-factor authentication turned off',
  'security.recovery_codes_regenerated': 'Recovery codes replaced',
  'security.session_revoked': 'Session signed out',
  'account.profile_updated': 'Profile updated',
  'wallet.withdrawal_requested': 'Withdrawal requested',
  'wallet.withdrawal_cancelled': 'Withdrawal cancelled',
  'fiat.bank_account_added': 'Bank account added',
  'fiat.bank_account_removed': 'Bank account removed',
  'kyc.submitted': 'Verification submitted',
};

export function activityLabel(action: string): string {
  return ACTIVITY[action] ?? action.replace(/^[a-z]+\./, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export const DOCUMENT_KINDS: { value: string; label: string }[] = [
  { value: 'national_id', label: 'National ID card' },
  { value: 'passport', label: 'International passport' },
  { value: 'drivers_licence', label: "Driver's licence" },
  { value: 'voters_card', label: "Permanent voter's card" },
];

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];
