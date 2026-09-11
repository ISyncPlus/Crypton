import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Activity,
  AppNotification,
  Asset,
  AssetCode,
  AuthResponse,
  Bank,
  BankAccount,
  ChainNetwork,
  CryptoDeposit,
  CryptoWithdrawal,
  DepositAddress,
  FiatConfig,
  FiatDeposit,
  FiatWithdrawal,
  KycStatus,
  KycSubmission,
  MarketAd,
  MeResponse,
  MyAd,
  P2PConfig,
  P2POrder,
  Page,
  Price,
  PricePoint,
  Quote,
  ResolvedAccount,
  Session,
  SimulatedCheckout,
  TradeKind,
  TradeOrder,
  TraderProfile,
  TwoFactorSetup,
  TwoFactorStatus,
  User,
  WalletTransaction,
  WalletsResponse,
  WithdrawalPreview,
} from './models';

export type Params = Record<string, string | number | boolean | null | undefined>;

export function toParams(params: Params = {}): HttpParams {
  let result = new HttpParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') {
      result = result.set(key, String(value));
    }
  }

  return result;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(url: string, params?: Params): Observable<T> {
    return this.http.get<T>(url, { params: toParams(params) });
  }

  post<T>(url: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(url, body);
  }

  put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(url, body);
  }

  patch<T>(url: string, body: unknown): Observable<T> {
    return this.http.patch<T>(url, body);
  }

  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(url);
  }

  // auth
  register = (body: { email: string; password: string; firstName: string; lastName: string }) => this.post<{ message: string }>('/api/auth/register', body);
  resendConfirmation = (email: string) => this.post<{ message: string }>('/api/auth/resend-confirmation', { email });
  confirmEmail = (userId: string, token: string) => this.post<{ confirmed: boolean }>('/api/auth/confirm-email', { userId, token });
  login = (email: string, password: string) => this.post<AuthResponse>('/api/auth/login', { email, password });
  loginTwoFactor = (challengeToken: string, code?: string, recoveryCode?: string) =>
    this.post<AuthResponse>('/api/auth/login/2fa', { challengeToken, code, recoveryCode });
  forgotPassword = (email: string) => this.post<{ message: string }>('/api/auth/forgot-password', { email });
  resetPassword = (userId: string, token: string, newPassword: string) => this.post<{ reset: boolean }>('/api/auth/reset-password', { userId, token, newPassword });
  logout = () => this.post<void>('/api/auth/logout');

  // account
  me = () => this.get<MeResponse>('/api/me');
  updateProfile = (body: { firstName?: string; lastName?: string; displayName?: string }) => this.patch<User>('/api/me', body);
  changePassword = (currentPassword: string, newPassword: string, twoFactorCode?: string) =>
    this.post<void>('/api/me/password', { currentPassword, newPassword, twoFactorCode });
  twoFactorStatus = () => this.get<TwoFactorStatus>('/api/me/2fa');
  twoFactorSetup = () => this.post<TwoFactorSetup>('/api/me/2fa/setup');
  twoFactorEnable = (code: string) => this.post<{ recoveryCodes: string[] }>('/api/me/2fa/enable', { code });
  twoFactorDisable = (password: string, code?: string, recoveryCode?: string) => this.post<void>('/api/me/2fa/disable', { password, code, recoveryCode });
  regenerateRecoveryCodes = (code: string) => this.post<{ recoveryCodes: string[] }>('/api/me/2fa/recovery-codes', { code });
  sessions = () => this.get<Session[]>('/api/me/sessions');
  revokeSession = (id: string) => this.delete<void>(`/api/me/sessions/${id}`);
  activity = () => this.get<Activity[]>('/api/me/activity');

  // notifications
  notifications = (params: Params) => this.get<Page<AppNotification>>('/api/notifications', params);
  unreadCount = () => this.get<{ count: number }>('/api/notifications/unread-count');
  markRead = (id: string) => this.post<void>(`/api/notifications/${id}/read`);
  markAllRead = () => this.post<void>('/api/notifications/read-all');

  // market
  assets = () => this.get<Asset[]>('/api/market/assets');
  prices = () => this.get<Price[]>('/api/market/prices');
  priceHistory = (asset: AssetCode, hours = 24) => this.get<PricePoint[]>(`/api/market/prices/${asset}/history`, { hours });
  networks = () => this.get<ChainNetwork[]>('/api/market/networks');

  // wallets
  wallets = () => this.get<WalletsResponse>('/api/wallets');
  transactions = (params: Params) => this.get<Page<WalletTransaction>>('/api/wallets/transactions', params);
  depositAddress = (asset: AssetCode) => this.get<DepositAddress>(`/api/wallets/${asset}/address`);
  cryptoDeposits = (params: Params) => this.get<Page<CryptoDeposit>>('/api/wallets/deposits', params);
  cryptoWithdrawals = (params: Params) => this.get<Page<CryptoWithdrawal>>('/api/wallets/withdrawals', params);
  withdrawalPreview = (asset: AssetCode, amount: string) => this.get<WithdrawalPreview>('/api/wallets/withdrawals/preview', { asset, amount });
  withdrawCrypto = (body: { asset: AssetCode; address: string; amount: string; twoFactorCode?: string; idempotencyKey: string }) =>
    this.post<CryptoWithdrawal>('/api/wallets/withdrawals', body);
  cancelCryptoWithdrawal = (id: string) => this.post<CryptoWithdrawal>(`/api/wallets/withdrawals/${id}/cancel`);
  simulateDeposit = (asset: AssetCode, amount: string) => this.post<CryptoDeposit>('/api/dev/simulate/crypto-deposit', { asset, amount });
  /** Development only: runs a background job immediately (e.g. chain-scan, withdrawal-processor). */
  runJob = (name: string) => this.post<void>(`/api/dev/jobs/${encodeURIComponent(name)}`);

  // trade
  quote = (body: { kind: TradeKind; fromAsset: AssetCode; toAsset: AssetCode; amount: string; side: 'From' | 'To' }) => this.post<Quote>('/api/trade/quotes', body);
  executeQuote = (quoteId: string, clientOrderId: string) => this.post<TradeOrder>('/api/trade/orders', { quoteId, clientOrderId });
  tradeOrders = (params: Params) => this.get<Page<TradeOrder>>('/api/trade/orders', params);

  // fiat
  fiatConfig = () => this.get<FiatConfig>('/api/fiat/config');
  banks = () => this.get<Bank[]>('/api/fiat/banks');
  resolveAccount = (bankCode: string, accountNumber: string) => this.post<ResolvedAccount>('/api/fiat/bank-accounts/resolve', { bankCode, accountNumber });
  bankAccounts = () => this.get<BankAccount[]>('/api/fiat/bank-accounts');
  addBankAccount = (bankCode: string, accountNumber: string) => this.post<BankAccount>('/api/fiat/bank-accounts', { bankCode, accountNumber });
  removeBankAccount = (id: string) => this.delete<void>(`/api/fiat/bank-accounts/${id}`);
  depositFiat = (amount: string) => this.post<FiatDeposit>('/api/fiat/deposits', { amount });
  fiatDeposits = (params: Params) => this.get<Page<FiatDeposit>>('/api/fiat/deposits', params);
  verifyFiatDeposit = (reference: string) => this.post<FiatDeposit>(`/api/fiat/deposits/${encodeURIComponent(reference)}/verify`);
  withdrawFiat = (body: { bankAccountId: string; amount: string; twoFactorCode?: string; idempotencyKey: string }) => this.post<FiatWithdrawal>('/api/fiat/withdrawals', body);
  fiatWithdrawals = (params: Params) => this.get<Page<FiatWithdrawal>>('/api/fiat/withdrawals', params);
  cancelFiatWithdrawal = (id: string) => this.post<FiatWithdrawal>(`/api/fiat/withdrawals/${id}/cancel`);
  simulatedCheckout = (reference: string) => this.get<SimulatedCheckout>(`/api/fiat/simulated-checkout/${encodeURIComponent(reference)}`);
  completeSimulatedCheckout = (reference: string, success: boolean) =>
    this.post<FiatDeposit>(`/api/fiat/simulated-checkout/${encodeURIComponent(reference)}`, { success });

  // kyc
  kycStatus = () => this.get<KycStatus>('/api/kyc');
  submitTier1 = (body: Record<string, string>) => this.post<KycSubmission>('/api/kyc/tier1', body);
  submitTier2 = (form: FormData) => this.post<KycSubmission>('/api/kyc/tier2', form);

  // p2p
  p2pConfig = () => this.get<P2PConfig>('/api/p2p/config');
  p2pMarket = (params: Params) => this.get<Page<MarketAd>>('/api/p2p/market', params);
  p2pAd = (id: string) => this.get<MarketAd>(`/api/p2p/ads/${id}`);
  myAds = () => this.get<MyAd[]>('/api/p2p/my-ads');
  createAd = (body: unknown) => this.post<MyAd>('/api/p2p/ads', body);
  updateAd = (id: string, body: unknown) => this.put<MyAd>(`/api/p2p/ads/${id}`, body);
  closeAd = (id: string) => this.post<MyAd>(`/api/p2p/ads/${id}/close`);
  createOrder = (body: { adId: string; fiatAmount?: string; quantity?: string; paymentMethodId?: string }) => this.post<P2POrder>('/api/p2p/orders', body);
  p2pOrders = (params: Params) => this.get<Page<P2POrder>>('/api/p2p/orders', params);
  p2pOrder = (id: string) => this.get<P2POrder>(`/api/p2p/orders/${id}`);
  markPaid = (id: string, paymentReference?: string) => this.post<P2POrder>(`/api/p2p/orders/${id}/paid`, { paymentReference });
  release = (id: string, twoFactorCode?: string) => this.post<P2POrder>(`/api/p2p/orders/${id}/release`, { twoFactorCode });
  cancelOrder = (id: string, reason?: string) => this.post<P2POrder>(`/api/p2p/orders/${id}/cancel`, { reason });
  openDispute = (id: string, reason: string) => this.post<P2POrder>(`/api/p2p/orders/${id}/dispute`, { reason });
  addEvidence = (id: string, form: FormData) => this.post<P2POrder>(`/api/p2p/orders/${id}/evidence`, form);
  evidenceFile = (orderId: string, evidenceId: string) => this.http.get(`/api/p2p/orders/${orderId}/evidence/${evidenceId}/file`, { responseType: 'blob' });
  leaveFeedback = (id: string, positive: boolean, comment?: string) => this.post<P2POrder>(`/api/p2p/orders/${id}/feedback`, { positive, comment });
  traderProfile = (userId: string) => this.get<TraderProfile>(`/api/p2p/traders/${userId}`);
}
