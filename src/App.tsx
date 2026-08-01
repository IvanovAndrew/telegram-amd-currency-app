import React, { useState, useEffect } from 'react';
import { 
  ArrowLeftRight, 
  Banknote, 
  CreditCard, 
  TrendingUp, 
  Coins,
  Loader2,
  AlertCircle
} from 'lucide-react';

// Telegram WebApp SDK type declaration (с расширенными методами)
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        setHeaderColor?: (color: string) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

interface ApiRateInfo {
  exchangePoint: string;
  baseCurrency: string;
  source: string;
  target: string;
  rate: number;
}

interface BankOption {
  id: string;
  bankName: string;
  rate: number;
  calculatedAmount: number;
  isBest?: boolean;
  logoColor: string;
  logoUrl?: string | null;
}

type Currency = 'AMD' | 'RUR' | 'USD' | 'EUR' | 'GEL';
const baseCurrency = 'AMD';

type CalculationMode = 'EXACT_SELL' | 'EXACT_BUY';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;


const BANK_LOGOS: Record<string, string> = {
  ameriabank: 'logos/ameriabank.webp',
  amiobank: 'logos/amiobank.webp',
  araratbank: 'logos/araratbank.webp',
  ardshinbank: 'logos/ardshinbank.webp',
  armeconombank: 'logos/armeconombank.webp',
  armswissbank: 'logos/armswissbank.webp',
  artsakhbank: 'logos/artsakhbank.webp',
  byblosbank: 'logos/byblosbank.webp',
  inecobank: 'logos/inecobank.webp',
  evocabank: 'logos/evocabank.webp',
  vtb: 'logos/vtbbank.webp',
  acba: 'logos/acbabank.webp',
  mellatbank: 'logos/mellatbank.webp',
  converse: 'logos/conversebank.webp',
  fastbank: 'logos/fastbank.webp',
  idbank: 'logos/idbank.webp',
  unibank: 'logos/unibank.webp',
};

const getBankLogo = (bankName: string): string | null => {
  const normalized = bankName.toLowerCase().replace(/\s+/g, '');
  for (const [key, logo] of Object.entries(BANK_LOGOS)) {
    if (normalized.includes(key)) return logo;
  }
  return null;
};

const BANK_COLORS: Record<string, string> = {
  ameriabank: '#00a859',
  amiobank: '#00529c',
  araratbank: '#f39c12',
  ardshinbank: '#00529c',
  armeconombank: '#00529c',
  armswissbank: '#e30613',
  artsakhbank: '#008559',
  byblosbank: '#f39c12',
  idbank: '#e30613',
  inecobank: '#00a859',
  mellatbank: '#e30613',
  evocabank: '#6f2b8d',
  vtb: '#002882',
  acba: '#008559',
  converse: '#f39c12',
  fastbank: '#6f2b8d',
  unibank: '#002882',
};

const getBankColor = (bankName: string): string => {
  const normalized = bankName.toLowerCase().replace(/\s+/g, '');
  for (const [key, color] of Object.entries(BANK_COLORS)) {
    if (normalized.includes(key)) return color;
  }
  return '#2c3e50';
};

export const App: React.FC = () => {
  const [calcMode, setCalcMode] = useState<CalculationMode>('EXACT_SELL');
  const [amount, setAmount] = useState<number>(100000);
  const [fromCurrency, setFromCurrency] = useState<Currency>('AMD');
  const [toCurrency, setToCurrency] = useState<Currency>('RUR');
  const [isCash, setIsCash] = useState<boolean>(false);
  
  const [results, setResults] = useState<BankOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram SDK
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('secondary_bg_color');
    }
  }, []);

  // Smart Handler: Changing FROM Currency
  const handleFromCurrencyChange = (newFrom: Currency) => {
    setFromCurrency(newFrom);
    if (newFrom !== 'AMD' && toCurrency !== 'AMD') {
      setToCurrency('AMD');
    }
  };

  // Smart Handler: Changing TO Currency
  const handleToCurrencyChange = (newTo: Currency) => {
    setToCurrency(newTo);
    if (newTo !== 'AMD' && fromCurrency !== 'AMD') {
      setFromCurrency('AMD');
    }
  };

  // Swap currencies instantly
  const handleSwapCurrencies = () => {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  // Fetch and recalculate rates from backend API
  useEffect(() => {
    const controller = new AbortController();

    const fetchRates = async () => {
      if (!amount || amount <= 0) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          source: fromCurrency,
          target: toCurrency,
          iscash: `${isCash}`,
        });

        const response = await fetch(`${API_BASE_URL}/api/MiniAppRates?${queryParams.toString()}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`Ошибка сервера (${response.status})`);
        }

        const data: ApiRateInfo[] = await response.json();

        if (!data || data.length === 0) {
          setResults([]);
          return;
        }

        const sortedData = [...data].sort((a, b) => {
          return calcMode === 'EXACT_SELL' ? b.rate - a.rate : a.rate - b.rate;
        });
        
        var bestRate = sortedData[0].rate;

        const mappedResults: BankOption[] = sortedData.map((item, index) => {
          const calculatedAmount = (calcMode === 'EXACT_SELL' && baseCurrency === item.source) || 
            (calcMode === 'EXACT_BUY' && baseCurrency === item.target)
            ? Math.round(amount / item.rate)
            : Math.round(amount * item.rate);

          return {
            id: `${item.exchangePoint}-${index}`,
            bankName: item.exchangePoint,
            rate: item.rate,
            calculatedAmount,
            isBest: item.rate === bestRate,
            logoColor: getBankColor(item.exchangePoint),
            logoUrl: getBankLogo(item.exchangePoint),
          };
        });

        setResults(mappedResults);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch rates:', err);
          setError(err.message || "Couldn't load exchange rates");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRates();

    return () => controller.abort();
  }, [amount, fromCurrency, toCurrency, isCash, calcMode]);

  const handleTabChange = (mode: CalculationMode) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    setCalcMode(mode);
  };

  return (
    <div style={styles.appContainer}>
      {/* Header Banner */}
      <div style={styles.topCard}>
        <div style={styles.topCardHeader}>
          <div style={styles.titleWithIcon}>
            <div style={styles.headerIconBadge}>
              <Coins size={20} color="var(--tg-theme-text-color, #1c1c1e)" />
            </div>
            <span style={styles.topCardTitle}>Currency exchange</span>
          </div>
          <span style={styles.liveTag}>Live rates</span>
        </div>

        {/* Calculation Mode Tabs */}
        <div style={styles.tabGroup}>
          <button
            onClick={() => handleTabChange('EXACT_SELL')}
            style={{
              ...styles.tabBtn,
              ...(calcMode === 'EXACT_SELL' ? styles.tabBtnActive : {}),
            }}
          >
            Sell
          </button>
          <button
            onClick={() => handleTabChange('EXACT_BUY')}
            style={{
              ...styles.tabBtn,
              ...(calcMode === 'EXACT_BUY' ? styles.tabBtnActive : {}),
            }}
          >
            Want to have
          </button>
        </div>

        {/* Amount Input Block */}
        <div style={styles.amountInputBlock}>
          <div style={styles.inputWrapper}>
            <input
              type="number"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              style={styles.heroInput}
              placeholder="0"
            />
            <span style={styles.currencySymbol}>
              {calcMode === 'EXACT_SELL' ? fromCurrency : toCurrency}
            </span>
          </div>
        </div>

        {/* Currency Pair selector with Smart Validation */}
        <div style={styles.currencyRow}>
          <div style={styles.currencySelectBox}>
            <span style={styles.selectHint}>Sell</span>
            <select
              value={fromCurrency}
              onChange={(e) => handleFromCurrencyChange(e.target.value as Currency)}
              style={styles.select}
            >
              <option value="AMD">AMD (֏)</option>
              <option value="RUR">RUR (₽)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GEL">GEL (₾)</option>
            </select>
          </div>

          <button onClick={handleSwapCurrencies} style={styles.swapButton} title="Swap currencies">
            <ArrowLeftRight size={18} color="#000000" />
          </button>

          <div style={styles.currencySelectBox}>
            <span style={styles.selectHint}>Buy</span>
            <select
              value={toCurrency}
              onChange={(e) => handleToCurrencyChange(e.target.value as Currency)}
              style={styles.select}
            >
              <option value="GEL">GEL (₾)</option>
              <option value="AMD">AMD (֏)</option>
              <option value="RUR">RUR (₽)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </div>
        </div>

        {/* Payment type pill selector */}
        <div style={styles.paymentPills}>
          <button
            onClick={() => setIsCash(true)}
            style={{
              ...styles.pillBtn,
              ...(isCash ? styles.pillBtnActive : {}),
            }}
          >
            <Banknote size={16} style={styles.pillIcon} />
            Cash
          </button>
          <button
            onClick={() => setIsCash(false)}
            style={{
              ...styles.pillBtn,
              ...(!isCash ? styles.pillBtnActive : {}),
            }}
          >
            <CreditCard size={16} style={styles.pillIcon} />
            Card
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div style={styles.resultsSection}>
        <div style={styles.sectionTitle}>
          {calcMode === 'EXACT_SELL'
            ? `You will get`
            : `Need to pay`}
        </div>

        {loading && (
          <div style={styles.stateContainer}>
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--tg-theme-hint-color, #8e8e93)' }} />
            <span style={styles.stateText}>Loading...</span>
          </div>
        )}

        {error && (
          <div style={{ ...styles.stateContainer, color: '#ff3b30' }}>
            <AlertCircle size={24} />
            <span style={styles.stateText}>{error}</span>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div style={styles.stateContainer}>
            <span style={styles.stateText}>Rates have not been found</span>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div style={styles.bankList}>
            {results.map((bank) => (
              <div key={bank.id} style={styles.bankCard}>
                <div style={styles.bankLeft}>
                  <div style={{ ...styles.bankAvatar, backgroundColor: bank.logoUrl ? 'transparent' : bank.logoColor }}>
                    {bank.logoUrl ? (
                      <img 
                        src={bank.logoUrl} 
                        alt={bank.bankName} 
                        style={styles.bankLogoImg}
                        onError={(e) => {
                          // If there is no logo, show the first letter
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }} 
                      />
                    ) : (
                      bank.bankName.charAt(0)
                    )}
                  </div>
                  <div style={styles.bankDetails}>
                    <div style={styles.bankNameRow}>
                      <span style={styles.bankName}>{bank.bankName}</span>
                      {bank.isBest && (
                        <span style={styles.bestBadge}>
                          <TrendingUp size={10} style={{ marginRight: 3 }} />
                          The best
                        </span>
                      )}
                    </div>
                    <span style={styles.rateSub}>
                      1 {toCurrency === baseCurrency ? fromCurrency : toCurrency} = {bank.rate} {baseCurrency}
                    </span>
                  </div>
                </div>

                <div style={styles.bankRight}>
                  <span style={styles.finalAmount}>
                    {bank.calculatedAmount.toLocaleString()}
                  </span>
                  <span style={styles.finalCurrency}>
                    {calcMode === 'EXACT_SELL' ? toCurrency : fromCurrency}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// CSS styles
const styles: { [key: string]: React.CSSProperties } = {
  appContainer: {
    maxWidth: '440px',
    margin: '0 auto',
    padding: '12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  topCard: {
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    borderRadius: '24px',
    padding: '20px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
    marginBottom: '16px',
  },
  topCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  titleWithIcon: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  headerIconBadge: {
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCardTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
  },
  liveTag: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#34c759',
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    padding: '4px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase',
  },
  tabGroup: {
    display: 'flex',
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: '14px',
    padding: '4px',
    marginBottom: '20px',
  },
  tabBtn: {
    flex: 1,
    padding: '10px',
    border: 'none',
    borderRadius: '10px',
    backgroundColor: 'transparent',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  tabBtnActive: {
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  amountInputBlock: {
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: '16px',
    padding: '14px 16px',
    marginBottom: '16px',
  },
  amountLabel: {
    fontSize: '12px',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
    fontWeight: '500',
    marginBottom: '4px',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '4px',
  },
  heroInput: {
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
    width: '50%',
    outline: 'none',
  },
  currencySymbol: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
  },
  currencyRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  currencySelectBox: {
    flex: 1,
    backgroundColor: 'var(--tg-theme-secondary-bg-color, #f2f2f7)',
    borderRadius: '14px',
    padding: '8px 12px',
  },
  selectHint: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
  },
  select: {
    width: '100%',
    border: 'none',
    backgroundColor: 'transparent',
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
    outline: 'none',
    cursor: 'pointer',
  },
  swapButton: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: '#ffdd2d',
    color: '#000000',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(255, 221, 45, 0.4)',
    flexShrink: 0,
  },
  paymentPills: {
    display: 'flex',
    gap: '8px',
  },
  pillBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: '12px',
    border: '1px solid var(--tg-theme-secondary-bg-color, #e5e5ea)',
    backgroundColor: 'transparent',
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  pillIcon: {
    opacity: 0.7,
  },
  pillBtnActive: {
    backgroundColor: 'var(--tg-theme-text-color, #1c1c1e)',
    color: 'var(--tg-theme-bg-color, #ffffff)',
    borderColor: 'var(--tg-theme-text-color, #1c1c1e)',
  },
  resultsSection: {
    padding: '0 4px',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },
  bankList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  bankCard: {
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    borderRadius: '18px',
    padding: '14px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
  },
  bankLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  bankAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '12px',
    color: '#ffffff',
    fontWeight: '700',
    fontSize: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankDetails: {
    display: 'flex',
    flexDirection: 'column',
  },
  bankNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  bankName: {
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
  },
  bestBadge: {
    backgroundColor: '#34c759',
    color: '#ffffff',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
  },
  rateSub: {
    fontSize: '12px',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
    marginTop: '2px',
  },
  bankRight: {
    textAlign: 'right',
  },
  finalAmount: {
    display: 'block',
    fontSize: '17px',
    fontWeight: '700',
    color: 'var(--tg-theme-text-color, #1c1c1e)',
  },
  finalCurrency: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
  },
  stateContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px 16px',
    gap: '10px',
    backgroundColor: 'var(--tg-theme-bg-color, #ffffff)',
    borderRadius: '18px',
  },
  stateText: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--tg-theme-hint-color, #8e8e93)',
  },
  bankLogoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    borderRadius: '12px',
  },
};

export default App;