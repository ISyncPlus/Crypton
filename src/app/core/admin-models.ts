// Back-office API contracts. Money values are decimal strings.
import {
  AmlAction,
  AmlAlertStatus,
  AmlSubjectType,
  AssetCode,
  Balance,
  BankAccount,
  CryptoDeposit,
  CryptoWithdrawalStatus,
  Decimal,
  DisputeEvidence,
  FiatDeposit,
  FiatWithdrawalStatus,
  KycDocumentType,
  KycIdType,
  KycSubmission,
  KycSubmissionStatus,
  KycTierLimits,
  P2PAdSide,
  P2PAdStatus,
  P2PDisputeStatus,
  P2POrderStatus,
  P2PPriceType,
  PaymentDetail,
  TradeOrder,
  User,
  UserStatus,
} from './models';

export type StaffRole = 'Admin' | 'Compliance' | 'Support';
export const STAFF_ROLES: StaffRole[] = ['Admin', 'Compliance', 'Support'];

export interface AnalyticsOverview {
  from: string;
  to: string;
  totalUsers: number;
  newUsers: number;
  verifiedUsers: number;
  tradeCount: number;
  tradeVolumeNgn: Decimal;
  p2PVolumeNgn: Decimal;
  p2PCompletedOrders: number;
  fiatDepositsNgn: Decimal;
  fiatWithdrawalsNgn: Decimal;
  cryptoDepositsNgn: Decimal;
  cryptoWithdrawalsNgn: Decimal;
  feesByAsset: Record<string, Decimal>;
  feesNgnEstimate: Decimal;
}

export interface QueueCounts {
  pendingKyc: number;
  pendingWithdrawals: number;
  withdrawalsNeedingAttention: number;
  openAmlAlerts: number;
  openDisputes: number;
}

export interface JobStatus {
  name: string;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export interface AdminDashboard {
  last24h: AnalyticsOverview;
  last7d: AnalyticsOverview;
  queues: QueueCounts;
  jobs: JobStatus[];
  priceFeed: { provider: string; lastRefreshAt: string | null; lastError: string | null };
  blockchainMode: string;
  paymentsProvider: string;
}

export type Metric = 'trade_volume' | 'p2p_volume' | 'signups' | 'fiat_deposits' | 'fiat_withdrawals' | 'crypto_deposits' | 'fees_ngn';

export interface TimePoint {
  date: string;
  value: Decimal;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  fullName: string;
  displayName: string | null;
  kycTier: number;
  status: UserStatus;
  twoFactorEnabled: boolean;
  emailConfirmed: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminUserDetail {
  user: User;
  frozenReason: string | null;
  emailConfirmed: boolean;
  lastLoginAt: string | null;
  lockoutEnd: string | null;
  balances: Balance[];
  kyc: KycSubmission[];
  openAlerts: number;
  activeSessions: number;
  bankAccounts: BankAccount[];
}

export interface AdminCryptoWithdrawal {
  id: string;
  userId: string;
  userEmail: string;
  asset: AssetCode;
  network: string;
  toAddress: string;
  amount: Decimal;
  fee: Decimal;
  ngnValue: Decimal;
  status: CryptoWithdrawalStatus;
  riskSummary: string | null;
  txHash: string | null;
  confirmations: number;
  networkFee: Decimal | null;
  broadcastAttempts: number;
  failureReason: string | null;
  reviewNote: string | null;
  settled: boolean;
  createdAt: string;
  broadcastAt: string | null;
  confirmedAt: string | null;
}

export interface AdminFiatWithdrawal {
  id: string;
  userId: string;
  userEmail: string;
  amount: Decimal;
  fee: Decimal;
  status: FiatWithdrawalStatus;
  reference: string;
  transferCode: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  riskSummary: string | null;
  failureReason: string | null;
  reviewNote: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AdminCryptoDepositRow {
  deposit: CryptoDeposit;
  userId: string;
  userEmail: string;
  address: string;
  ngnValue: Decimal;
}

export interface AdminFiatDepositRow {
  deposit: FiatDeposit;
  userId: string;
  userEmail: string;
  provider: string;
  providerFee: Decimal;
  gatewayResponse: string | null;
}

export interface AdminTradeRow {
  trade: TradeOrder;
  userId: string;
  userEmail: string;
}

export interface AdminKycDocument {
  id: string;
  type: KycDocumentType;
  contentType: string;
  sizeBytes: number;
}

export interface AdminKycSubmission {
  id: string;
  userId: string;
  userEmail: string;
  targetTier: number;
  status: KycSubmissionStatus;
  provider: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  address: string | null;
  idType: KycIdType | null;
  idNumberMasked: string | null;
  documentKind: string | null;
  providerResult: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  documents: AdminKycDocument[];
}

export interface AdminAlert {
  id: string;
  userId: string;
  userEmail: string;
  ruleCode: string;
  action: AmlAction;
  severity: number;
  subjectType: AmlSubjectType;
  subjectId: string | null;
  summary: string;
  details: string | null;
  status: AmlAlertStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AmlRuleConfig {
  code: string;
  enabled: boolean;
  action: AmlAction;
  thresholdNgn: Decimal | null;
  count: number | null;
  windowMinutes: number | null;
  ratio: Decimal | null;
}

export interface AmlSettings {
  rules: AmlRuleConfig[];
}

export interface BlockedAddress {
  id: string;
  network: string;
  address: string;
  reason: string;
  source: string;
  createdBy: string | null;
  createdAt: string;
}

export interface AdminP2POrder {
  id: string;
  orderNumber: string;
  status: P2POrderStatus;
  adSide: P2PAdSide;
  asset: AssetCode;
  quantity: Decimal;
  price: Decimal;
  fiatAmount: Decimal;
  fee: Decimal;
  buyerId: string;
  buyerEmail: string;
  sellerId: string;
  sellerEmail: string;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
}

export interface AdminDispute {
  id: string;
  status: P2PDisputeStatus;
  reason: string;
  openedByRole: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  order: AdminP2POrder;
  paymentDetails: PaymentDetail[];
  buyerPaymentReference: string | null;
  evidence: DisputeEvidence[];
}

export interface AdminAd {
  id: string;
  userId: string;
  userEmail: string;
  side: P2PAdSide;
  asset: AssetCode;
  priceType: P2PPriceType;
  fixedPrice: Decimal | null;
  floatingMarginBps: number;
  totalQuantity: Decimal;
  remainingQuantity: Decimal;
  status: P2PAdStatus;
  suspendedByAdmin: boolean;
  createdAt: string;
}

export interface AdminAudit {
  id: number;
  userId: string | null;
  actorUserId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  data: string | null;
  createdAt: string;
}

export interface TreasuryAsset {
  asset: AssetCode;
  custodyHeld: Decimal;
  treasuryInventory: Decimal;
  feesEarned: Decimal;
  p2PEscrow: Decimal;
  networkFeesPaid: Decimal;
  paymentCosts: Decimal;
  adjustments: Decimal;
  userAvailable: Decimal;
  userLocked: Decimal;
  pendingWithdrawals: Decimal;
  hotWalletAddress: string | null;
  hotWalletBalance: Decimal | null;
  hotWalletError: string | null;
}

export interface LedgerCheckReport {
  ok: boolean;
  checkedAt: string;
  checks: { name: string; ok: boolean; problems: string[] }[];
}

export interface TradingSettings {
  buyFeeBps: number;
  sellFeeBps: number;
  swapFeeBps: number;
  spreadBps: number;
  quoteTtlSeconds: number;
  maxPriceAgeSeconds: number;
  minOrderNgn: Decimal;
  maxOrderNgn: Decimal;
}

export interface WithdrawalSettings {
  requireTwoFactor: boolean;
  securityLockHours: number;
  manualReviewAboveNgn: Decimal;
  fiatWithdrawalFeeNgn: Decimal;
  minFiatWithdrawalNgn: Decimal;
  maxFiatWithdrawalNgn: Decimal;
}

export interface FiatSettings {
  depositFeeBps: number;
  depositFeeCapNgn: Decimal;
  minDepositNgn: Decimal;
  maxDepositNgn: Decimal;
}

export interface P2PSettings {
  makerFeeBps: number;
  paymentWindowsMinutes: number[];
  disputeAfterMinutes: number;
  maxOpenOrdersPerUser: number;
  minKycTier: number;
  maxFloatingMarginBps: number;
  minOrderFiat: Decimal;
}

export interface KycLimitSettings {
  tiers: KycTierLimits[];
}

export interface AdminSettings {
  trading: TradingSettings;
  withdrawals: WithdrawalSettings;
  fiat: FiatSettings;
  p2P: P2PSettings;
  kycLimits: KycLimitSettings;
}

export interface AssetUpdate {
  minDeposit: Decimal;
  minWithdrawal: Decimal;
  withdrawalFee: Decimal;
  requiredConfirmations: number;
  depositsEnabled: boolean;
  withdrawalsEnabled: boolean;
  tradingEnabled: boolean;
}

export type ReportType = 'trades' | 'crypto-deposits' | 'crypto-withdrawals' | 'fiat-deposits' | 'fiat-withdrawals' | 'p2p-orders' | 'ledger';
