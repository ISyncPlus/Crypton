import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminAd,
  AdminAlert,
  AdminAudit,
  AdminCryptoDepositRow,
  AdminCryptoWithdrawal,
  AdminDashboard,
  AdminDispute,
  AdminFiatDepositRow,
  AdminFiatWithdrawal,
  AdminKycSubmission,
  AdminP2POrder,
  AdminSettings,
  AdminTradeRow,
  AdminUserDetail,
  AdminUserListItem,
  AmlSettings,
  AnalyticsOverview,
  AssetUpdate,
  BlockedAddress,
  FiatSettings,
  KycLimitSettings,
  LedgerCheckReport,
  Metric,
  P2PSettings,
  ReportType,
  TimePoint,
  TradingSettings,
  TreasuryAsset,
  WithdrawalSettings,
} from './admin-models';
import { Params, toParams } from './api.service';
import { AmlAlertStatus, Asset, Page } from './models';

const base = '/api/admin';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  private get<T>(url: string, params?: Params): Observable<T> {
    return this.http.get<T>(base + url, { params: toParams(params) });
  }

  private post<T>(url: string, body: unknown = {}): Observable<T> {
    return this.http.post<T>(base + url, body);
  }

  private put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(base + url, body);
  }

  // overview
  dashboard = () => this.get<AdminDashboard>('/dashboard');
  overview = (from?: string, to?: string) => this.get<AnalyticsOverview>('/analytics/overview', { from, to });
  timeSeries = (metric: Metric, from?: string, to?: string) => this.get<TimePoint[]>('/analytics/timeseries', { metric, from, to });
  report = (type: ReportType, from?: string, to?: string) =>
    this.http.get(`${base}/reports/${type}.csv`, { params: toParams({ from, to }), responseType: 'blob', observe: 'response' });
  ledgerCheck = () => this.get<LedgerCheckReport>('/system/ledger-check');

  // users
  users = (params: Params) => this.get<Page<AdminUserListItem>>('/users', params);
  user = (id: string) => this.get<AdminUserDetail>(`/users/${id}`);
  freezeUser = (id: string, reason: string) => this.post<void>(`/users/${id}/freeze`, { reason });
  unfreezeUser = (id: string) => this.post<void>(`/users/${id}/unfreeze`);
  resetTwoFactor = (id: string, reason: string) => this.post<void>(`/users/${id}/reset-2fa`, { reason });
  revokeSessions = (id: string) => this.post<void>(`/users/${id}/revoke-sessions`);
  setRoles = (id: string, roles: string[]) => this.put<void>(`/users/${id}/roles`, { roles });
  adjustBalance = (id: string, asset: string, amount: string, reason: string) => this.post<void>(`/users/${id}/adjust-balance`, { asset, amount, reason });

  // money movement
  cryptoWithdrawals = (params: Params) => this.get<Page<AdminCryptoWithdrawal>>('/withdrawals/crypto', params);
  approveCrypto = (id: string, note?: string) => this.post<AdminCryptoWithdrawal>(`/withdrawals/crypto/${id}/approve`, { note });
  rejectCrypto = (id: string, reason: string) => this.post<AdminCryptoWithdrawal>(`/withdrawals/crypto/${id}/reject`, { reason });
  retryCrypto = (id: string, reason: string) => this.post<AdminCryptoWithdrawal>(`/withdrawals/crypto/${id}/retry`, { reason });
  refundCrypto = (id: string, reason: string) => this.post<AdminCryptoWithdrawal>(`/withdrawals/crypto/${id}/refund`, { reason });
  markCryptoSent = (id: string, txHash: string, note: string) => this.post<AdminCryptoWithdrawal>(`/withdrawals/crypto/${id}/mark-sent`, { txHash, note });
  fiatWithdrawals = (params: Params) => this.get<Page<AdminFiatWithdrawal>>('/withdrawals/fiat', params);
  approveFiat = (id: string, note?: string) => this.post<AdminFiatWithdrawal>(`/withdrawals/fiat/${id}/approve`, { note });
  rejectFiat = (id: string, reason: string) => this.post<AdminFiatWithdrawal>(`/withdrawals/fiat/${id}/reject`, { reason });
  cryptoDeposits = (params: Params) => this.get<Page<AdminCryptoDepositRow>>('/deposits/crypto', params);
  fiatDeposits = (params: Params) => this.get<Page<AdminFiatDepositRow>>('/deposits/fiat', params);
  trades = (params: Params) => this.get<Page<AdminTradeRow>>('/trades', params);
  treasury = (onChain = true) => this.get<TreasuryAsset[]>('/treasury', { onChain });
  fundTreasury = (body: { asset: string; amount: string; reference: string; note: string }) => this.post<void>('/treasury/fund', body);
  defundTreasury = (body: { asset: string; amount: string; reference: string; note: string }) => this.post<void>('/treasury/defund', body);

  // compliance
  kycSubmissions = (params: Params) => this.get<Page<AdminKycSubmission>>('/kyc', params);
  kycSubmission = (id: string) => this.get<AdminKycSubmission>(`/kyc/${id}`);
  revealId = (id: string) => this.post<{ idNumber: string }>(`/kyc/${id}/reveal-id`);
  kycDocument = (documentId: string) => this.http.get(`${base}/kyc/documents/${documentId}`, { responseType: 'blob' });
  approveKyc = (id: string, note?: string) => this.post<AdminKycSubmission>(`/kyc/${id}/approve`, { note });
  rejectKyc = (id: string, reason: string) => this.post<AdminKycSubmission>(`/kyc/${id}/reject`, { reason });
  alerts = (params: Params) => this.get<Page<AdminAlert>>('/aml/alerts', params);
  resolveAlert = (id: string, status: Exclude<AmlAlertStatus, 'Open'>, note?: string) => this.post<void>(`/aml/alerts/${id}/resolve`, { status, note });
  amlRules = () => this.get<AmlSettings>('/aml/rules');
  saveAmlRules = (settings: AmlSettings) => this.put<AmlSettings>('/aml/rules', settings);
  blockedAddresses = (params: Params) => this.get<Page<BlockedAddress>>('/aml/blocked-addresses', params);
  blockAddress = (network: string, address: string, reason: string) => this.post<BlockedAddress>('/aml/blocked-addresses', { network, address, reason });
  importBlockList = (network: string, addresses: string, reason: string, source?: string) =>
    this.post<{ added: number; invalid: string[] }>('/aml/blocked-addresses/import', { network, addresses, reason, source });
  unblockAddress = (id: string) => this.http.delete<void>(`${base}/aml/blocked-addresses/${id}`);

  // p2p
  p2pOrders = (params: Params) => this.get<Page<AdminP2POrder>>('/p2p/orders', params);
  disputes = (params: Params) => this.get<Page<AdminDispute>>('/p2p/disputes', params);
  dispute = (id: string) => this.get<AdminDispute>(`/p2p/disputes/${id}`);
  disputeEvidenceFile = (id: string, evidenceId: string) => this.http.get(`${base}/p2p/disputes/${id}/evidence/${evidenceId}`, { responseType: 'blob' });
  resolveDispute = (id: string, releaseToBuyer: boolean, note: string) => this.post<AdminDispute>(`/p2p/disputes/${id}/resolve`, { releaseToBuyer, note });
  ads = (params: Params) => this.get<Page<AdminAd>>('/p2p/ads', params);
  suspendAd = (id: string, reason: string) => this.post<void>(`/p2p/ads/${id}/suspend`, { reason });
  unsuspendAd = (id: string) => this.post<void>(`/p2p/ads/${id}/unsuspend`);

  // settings
  settings = () => this.get<AdminSettings>('/settings');
  saveTrading = (value: TradingSettings) => this.put<TradingSettings>('/settings/trading', value);
  saveWithdrawals = (value: WithdrawalSettings) => this.put<WithdrawalSettings>('/settings/withdrawals', value);
  saveFiat = (value: FiatSettings) => this.put<FiatSettings>('/settings/fiat', value);
  saveP2P = (value: P2PSettings) => this.put<P2PSettings>('/settings/p2p', value);
  saveKycLimits = (value: KycLimitSettings) => this.put<KycLimitSettings>('/settings/kyc-limits', value);
  assets = () => this.get<Asset[]>('/assets');
  updateAsset = (code: string, value: AssetUpdate) => this.put<Asset>(`/assets/${code}`, value);
  audit = (params: Params) => this.get<Page<AdminAudit>>('/audit', params);
}
