import { AssetCode } from '../../core/models';

export const CRYPTO_ASSETS: AssetCode[] = ['BTC', 'ETH', 'USDT'];

export function assetFromSlug(slug: string | null | undefined): AssetCode | null {
  const code = (slug ?? '').toUpperCase();
  return (CRYPTO_ASSETS as string[]).includes(code) ? (code as AssetCode) : null;
}

/** Plain-language network warning shown next to every deposit address. */
export function networkWarning(asset: AssetCode, networkName: string): string {
  switch (asset) {
    case 'BTC':
      return `Send only Bitcoin on the ${networkName} network. Anything else sent here will be lost.`;
    case 'ETH':
      return `Send only ETH on ${networkName}. Tokens and coins from other networks sent here will be lost.`;
    case 'USDT':
      return `Send only USDT as an ERC-20 token on ${networkName}. USDT sent on Tron (TRC-20), BNB Chain or any other network will be lost.`;
    default:
      return '';
  }
}

export function looksLikeAddress(asset: AssetCode, address: string): boolean {
  const value = address.trim();
  if (asset === 'ETH' || asset === 'USDT') {
    return /^0x[0-9a-fA-F]{40}$/.test(value);
  }

  return /^[a-zA-Z0-9]{26,90}$/.test(value);
}
