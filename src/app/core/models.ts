// API contracts. Money values are decimal strings to keep full precision.
export type Decimal = string;

export type AssetCode = 'BTC' | 'ETH' | 'USDT' | 'NGN';
export type UserStatus = 'Active' | 'Frozen' | 'Closed';
export type TradeKind = 'Buy' | 'Sell' | 'Swap';
export type AmountSide = 'From' | 'To';
export type CryptoDepositStatus = 'Pending' | 'Credited' | 'Rejected';
export type CryptoWithdrawalStatus =
  | 'PendingReview'
  | 'Approved'
  | 'Broadcasting'
  | 'Broadcast'
  | 'Confirmed'
  | 'Rejected'
  | 'Cancelled'
  | 'Failed'
  | 'NeedsAttention';
export type FiatDepositStatus = 'Initiated' | 'Succeeded' | 'Failed' | 'Abandoned';
export type FiatWithdrawalStatus =
  | 'PendingReview'
  | 'Approved'
  | 'Processing'
  | 'Succeeded'
  | 'Failed'
  | 'Reversed'
  | 'Rejected'
  | 'Cancelled'
  | 'NeedsAttention';
export type KycSubmissionStatus = 'Pending' | 'Approved' | 'Rejected';
export type KycIdType = 'NIN' | 'BVN';
export type KycDocumentType = 'IdFront' | 'IdBack' | 'Selfie' | 'ProofOfAddress';
export type LimitKind = 'FiatDeposit' | 'FiatWithdrawal' | 'CryptoWithdrawal' | 'Trade';
export type P2PAdSide = 'Sell' | 'Buy';
export type P2PPriceType = 'Fixed' | 'Floating';
export type P2PAdStatus = 'Active' | 'Paused' | 'Closed';
export type P2POrderStatus =
  | 'PendingPayment'
  | 'Paid'
  | 'Completed'
  | 'Cancelled'
  | 'Expired'
  | 'Disputed'
  | 'ResolvedToBuyer'
  | 'ResolvedToSeller';
export type P2PDisputeStatus = 'Open' | 'ResolvedToBuyer' | 'ResolvedToSeller';
export type AmlAction = 'Flag' | 'Review' | 'Block';
export type AmlAlertStatus = 'Open' | 'Dismissed' | 'Confirmed';
export type AmlSubjectType =
  | 'CryptoWithdrawal'
  | 'FiatWithdrawal'
  | 'CryptoDeposit'
  | 'FiatDeposit'
  | 'Trade'
  | 'P2POrder'
  | 'Login'
  | 'Account';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Problem {
  status: number;
  code: string;
  title: string;
  details?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

// ---------------------------------------------------------------- auth & account
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  kycTier: number;
  status: UserStatus;
  twoFactorEnabled: boolean;
  roles: string[];
  withdrawalsLockedUntil: string | null;
  createdAt: string;
}

export interface AuthResponse {
  requiresTwoFactor: boolean;
  challengeToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  user: User | null;
}

export interface LimitUsage {
  kind: LimitKind;
  dailyLimitNgn: Decimal;
  usedNgn: Decimal;
  remainingNgn: Decimal;
}

export interface MeResponse {
  user: User;
  limits: LimitUsage[];
  unreadNotifications: number;
}

export interface TwoFactorSetup {
  sharedKey: string;
  otpAuthUri: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  recoveryCodesLeft: number;
}

export interface Session {
  id: string;
  device: string;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  current: boolean;
}

export interface Activity {
  action: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------- market & wallets
export interface Asset {
  code: AssetCode;
  name: string;
  isFiat: boolean;
  precision: number;
  network: string | null;
  requiredConfirmations: number;
  minDeposit: Decimal;
  minWithdrawal: Decimal;
  withdrawalFee: Decimal;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  tradingEnabled: boolean;
}

export interface Price {
  asset: AssetCode;
  priceNgn: Decimal;
  priceUsd: Decimal;
  change24hPercent: Decimal | null;
  updatedAt: string;
  source: string;
}

export interface PricePoint {
  at: string;
  priceNgn: Decimal;
}

export interface Balance {
  asset: AssetCode;
  available: Decimal;
  locked: Decimal;
  total: Decimal;
  valueNgn: Decimal;
}

export interface WalletsResponse {
  balances: Balance[];
  totalValueNgn: Decimal;
  pricesAvailable: boolean;
}

export interface WalletTransaction {
  journalEntryId: string;
  type: string;
  asset: AssetCode;
  amount: Decimal;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface DepositAddress {
  asset: AssetCode;
  network: string;
  address: string;
  requiredConfirmations: number;
  minDeposit: Decimal;
  simulated: boolean;
}

export interface CryptoDeposit {
  id: string;
  asset: AssetCode;
  network: string;
  txHash: string;
  amount: Decimal;
  confirmations: number;
  requiredConfirmations: number;
  status: CryptoDepositStatus;
  rejectionReason: string | null;
  detectedAt: string;
  creditedAt: string | null;
}

export interface CryptoWithdrawal {
  id: string;
  asset: AssetCode;
  network: string;
  toAddress: string;
  amount: Decimal;
  fee: Decimal;
  status: CryptoWithdrawalStatus;
  txHash: string | null;
  confirmations: number;
  failureReason: string | null;
  createdAt: string;
  broadcastAt: string | null;
  confirmedAt: string | null;
}

export interface WithdrawalPreview {
  asset: AssetCode;
  amount: Decimal;
  fee: Decimal;
  totalDebit: Decimal;
  available: Decimal;
  minWithdrawal: Decimal;
  ngnValue: Decimal;
}

// ---------------------------------------------------------------- trading
export interface Quote {
  id: string;
  kind: TradeKind;
  fromAsset: AssetCode;
  toAsset: AssetCode;
  fromAmount: Decimal;
  toAmount: Decimal;
  fee: Decimal;
  feeAsset: AssetCode;
  rate: Decimal;
  ngnValue: Decimal;
  expiresAt: string;
}

export interface TradeOrder {
  id: string;
  kind: TradeKind;
  fromAsset: AssetCode;
  toAsset: AssetCode;
  fromAmount: Decimal;
  toAmount: Decimal;
  fee: Decimal;
  feeAsset: AssetCode;
  rate: Decimal;
  ngnValue: Decimal;
  createdAt: string;
}

// ---------------------------------------------------------------- fiat
export interface FiatConfig {
  provider: string;
  simulated: boolean;
  depositFeeBps: number;
  depositFeeCapNgn: Decimal;
  minDepositNgn: Decimal;
  maxDepositNgn: Decimal;
  withdrawalFeeNgn: Decimal;
  minWithdrawalNgn: Decimal;
  maxWithdrawalNgn: Decimal;
}

export interface Bank {
  code: string;
  name: string;
}

export interface ResolvedAccount {
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export interface BankAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  createdAt: string;
}

export interface FiatDeposit {
  id: string;
  reference: string;
  amount: Decimal;
  fee: Decimal;
  status: FiatDepositStatus;
  authorizationUrl: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface FiatWithdrawal {
  id: string;
  reference: string;
  amount: Decimal;
  fee: Decimal;
  status: FiatWithdrawalStatus;
  bankName: string;
  accountNumber: string;
  accountName: string;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SimulatedCheckout {
  reference: string;
  amount: Decimal;
  status: string;
  email: string;
}

// ---------------------------------------------------------------- kyc
export interface KycTierLimits {
  tier: number;
  name: string;
  fiatEnabled: boolean;
  p2PEnabled: boolean;
  dailyFiatDepositNgn: Decimal;
  dailyFiatWithdrawalNgn: Decimal;
  dailyCryptoWithdrawalNgn: Decimal;
  dailyTradeNgn: Decimal;
}

export interface KycSubmission {
  id: string;
  targetTier: number;
  status: KycSubmissionStatus;
  provider: string;
  rejectionReason: string | null;
  documentKind: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface KycStatus {
  currentTier: number;
  tiers: KycTierLimits[];
  submissions: KycSubmission[];
  canSubmitTier1: boolean;
  canSubmitTier2: boolean;
}

// ---------------------------------------------------------------- p2p
export interface Trader {
  userId: string;
  displayName: string;
  verified: boolean;
  memberSince: string;
  completedOrders30d: number;
  completionRate30d: Decimal;
  averageReleaseMinutes: number | null;
  positiveFeedback: number;
  negativeFeedback: number;
}

export interface MarketAd {
  id: string;
  side: P2PAdSide;
  asset: AssetCode;
  fiatCurrency: string;
  priceType: P2PPriceType;
  floatingMarginBps: number;
  price: Decimal;
  remainingQuantity: Decimal;
  minOrderFiat: Decimal;
  maxOrderFiat: Decimal;
  paymentWindowMinutes: number;
  paymentBanks: string[];
  terms: string | null;
  maker: Trader;
}

export interface MyAd {
  id: string;
  side: P2PAdSide;
  asset: AssetCode;
  priceType: P2PPriceType;
  fixedPrice: Decimal | null;
  floatingMarginBps: number;
  effectivePrice: Decimal;
  totalQuantity: Decimal;
  remainingQuantity: Decimal;
  reservedAmount: Decimal;
  minOrderFiat: Decimal;
  maxOrderFiat: Decimal;
  paymentWindowMinutes: number;
  paymentMethodIds: string[];
  terms: string | null;
  status: P2PAdStatus;
  suspendedByAdmin: boolean;
  createdAt: string;
}

export interface PaymentDetail {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface DisputeEvidence {
  id: string;
  party: string;
  text: string | null;
  fileName: string | null;
  hasFile: boolean;
  createdAt: string;
}

export interface Dispute {
  id: string;
  status: P2PDisputeStatus;
  openedBy: string;
  reason: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  evidence: DisputeEvidence[];
}

export interface P2POrder {
  id: string;
  orderNumber: string;
  adId: string;
  myRole: 'buyer' | 'seller';
  adSide: P2PAdSide;
  asset: AssetCode;
  fiatCurrency: string;
  quantity: Decimal;
  price: Decimal;
  fiatAmount: Decimal;
  fee: Decimal;
  receiveQuantity: Decimal;
  status: P2POrderStatus;
  paymentDeadline: string;
  paymentDetails: PaymentDetail[];
  buyerPaymentReference: string | null;
  cancelReason: string | null;
  counterparty: Trader;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  disputeAvailableAt: string | null;
  dispute: Dispute | null;
  feedbackGiven: boolean;
}

export interface P2PConfig {
  makerFeeBps: number;
  paymentWindowsMinutes: number[];
  disputeAfterMinutes: number;
  maxOpenOrdersPerUser: number;
  minKycTier: number;
  maxFloatingMarginBps: number;
  minOrderFiat: Decimal;
}

export interface Feedback {
  positive: boolean;
  comment: string | null;
  fromDisplayName: string;
  createdAt: string;
}

export interface TraderProfile {
  trader: Trader;
  recentFeedback: Feedback[];
}
