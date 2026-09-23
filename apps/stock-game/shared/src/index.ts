export const SIDES = ['buy', 'sell', 'short', 'cover'] as const;
export type Side = (typeof SIDES)[number];

export const TRADE_MODES = ['backdated', 'scheduled'] as const;
export type TradeMode = (typeof TRADE_MODES)[number];

export const ORDER_STATUSES = ['pending', 'filled', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const INTERVALS = ['1m', '5m', '15m', '30m', '60m', '1d', '1wk', '1mo'] as const;
export type Interval = (typeof INTERVALS)[number];

export const ORDER_TYPES = ['market', 'limit', 'stop', 'stopLimit'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const TIFS = ['DAY', 'GTC'] as const;
export type Tif = (typeof TIFS)[number];

export const FILL_PRICE_SOURCES = ['last', 'bid', 'ask', 'mid'] as const;
export type FillPriceSource = (typeof FILL_PRICE_SOURCES)[number];

export function defaultFillPriceSource(side: Side): FillPriceSource {
    if (side === 'buy' || side === 'cover') return 'ask';
    return 'bid';
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asInt(value: unknown): number | undefined {
    const n = asNumber(value);
    return n !== undefined && Number.isInteger(n) ? n : undefined;
}

function requireString(value: unknown, label: string): string {
    const s = asString(value);
    if (s === undefined) throw new Error(`invalid ${label}`);
    return s;
}

function requireInt(value: unknown, label: string): number {
    const n = asInt(value);
    if (n === undefined) throw new Error(`invalid ${label}`);
    return n;
}

function requireNumber(value: unknown, label: string): number {
    const n = asNumber(value);
    if (n === undefined) throw new Error(`invalid ${label}`);
    return n;
}

function optionalString(value: unknown): string | undefined {
    const s = asString(value);
    return s;
}

function optionalNumber(value: unknown): number | undefined {
    const n = asNumber(value);
    return n;
}

function optionalInt(value: unknown): number | undefined {
    const n = asInt(value);
    return n;
}

function parseSymbol(raw: unknown): string {
    const s = asString(raw);
    if (s === undefined) throw new Error('invalid symbol');
    const trimmed = s.trim().toUpperCase();
    if (trimmed.length < 1 || trimmed.length > 16) throw new Error('invalid symbol');
    return trimmed;
}

function parseQty(raw: unknown): number {
    const n = asInt(raw);
    if (n === undefined || n <= 0) throw new Error('invalid qty');
    return n;
}

function parseSide(raw: unknown): Side {
    const s = asString(raw);
    if (s === undefined || !(SIDES as readonly string[]).includes(s)) throw new Error('invalid side');
    return s as Side;
}

function parseTradeMode(raw: unknown): TradeMode {
    const s = asString(raw);
    if (s === undefined || !(TRADE_MODES as readonly string[]).includes(s)) throw new Error('invalid trade mode');
    return s as TradeMode;
}

function parseOrderStatus(raw: unknown): OrderStatus {
    const s = asString(raw);
    if (s === undefined || !(ORDER_STATUSES as readonly string[]).includes(s)) throw new Error('invalid order status');
    return s as OrderStatus;
}

export function parseInterval(raw: unknown): Interval {
    const s = asString(raw);
    if (s === undefined || !(INTERVALS as readonly string[]).includes(s)) throw new Error('invalid interval');
    return s as Interval;
}

function parseOrderType(raw: unknown): OrderType {
    const s = asString(raw);
    if (s === undefined || !(ORDER_TYPES as readonly string[]).includes(s)) throw new Error('invalid order type');
    return s as OrderType;
}

function parseTif(raw: unknown): Tif {
    const s = asString(raw);
    if (s === undefined || !(TIFS as readonly string[]).includes(s)) throw new Error('invalid tif');
    return s as Tif;
}

function parseFillPriceSource(raw: unknown): FillPriceSource {
    const s = asString(raw);
    if (s === undefined || !(FILL_PRICE_SOURCES as readonly string[]).includes(s))
        throw new Error('invalid fill price source');
    return s as FillPriceSource;
}

export interface SymbolSearchResult {
    symbol: string;
    name: string;
    exchange: string;
    type: string;
}

export function parseSymbolSearchResult(raw: unknown): SymbolSearchResult {
    if (!isRecord(raw)) throw new Error('invalid symbol search result');
    return {
        symbol: parseSymbol(raw['symbol']),
        name: requireString(raw['name'], 'symbol name'),
        exchange: requireString(raw['exchange'], 'exchange'),
        type: requireString(raw['type'], 'type'),
    };
}

export interface Quote {
    symbol: string;
    name: string;
    price: number;
    currency: string;
    exchange: string;
    time: number;
    delayMinutes: number;
    bid?: number;
    ask?: number;
}

export function parseQuote(raw: unknown): Quote {
    if (!isRecord(raw)) throw new Error('invalid quote');
    const quote: Quote = {
        symbol: parseSymbol(raw['symbol']),
        name: requireString(raw['name'], 'quote name'),
        price: requireNumber(raw['price'], 'quote price'),
        currency: requireString(raw['currency'], 'currency'),
        exchange: requireString(raw['exchange'], 'exchange'),
        time: requireInt(raw['time'], 'quote time'),
        delayMinutes: raw['delayMinutes'] === undefined ? 0 : requireInt(raw['delayMinutes'], 'delayMinutes'),
    };
    const bid = optionalNumber(raw['bid']);
    if (bid !== undefined) {
        if (bid <= 0) throw new Error('invalid bid');
        quote.bid = bid;
    }
    const ask = optionalNumber(raw['ask']);
    if (ask !== undefined) {
        if (ask <= 0) throw new Error('invalid ask');
        quote.ask = ask;
    }
    return quote;
}

export interface Bar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export function parseBar(raw: unknown): Bar {
    if (!isRecord(raw)) throw new Error('invalid bar');
    return {
        time: requireInt(raw['time'], 'bar time'),
        open: requireNumber(raw['open'], 'bar open'),
        high: requireNumber(raw['high'], 'bar high'),
        low: requireNumber(raw['low'], 'bar low'),
        close: requireNumber(raw['close'], 'bar close'),
        volume: requireInt(raw['volume'], 'bar volume'),
    };
}

export interface GameConfig {
    startingCashCents: number;
    startDate: number;
    provider: string;
    quoteDelayMinutes: number;
    commissionCentsPerTrade: number;
}

export function parseGameConfig(raw: unknown): GameConfig {
    if (!isRecord(raw)) throw new Error('invalid game config');
    return {
        startingCashCents: requireInt(raw['startingCashCents'], 'startingCashCents'),
        startDate: requireInt(raw['startDate'], 'startDate'),
        provider: requireString(raw['provider'], 'provider'),
        quoteDelayMinutes:
            raw['quoteDelayMinutes'] === undefined ? 15 : requireInt(raw['quoteDelayMinutes'], 'quoteDelayMinutes'),
        commissionCentsPerTrade:
            raw['commissionCentsPerTrade'] === undefined
                ? 0
                : requireInt(raw['commissionCentsPerTrade'], 'commissionCentsPerTrade'),
    };
}

export interface UpdateConfigRequest {
    startingCashCents: number;
    startDate: number;
    provider?: string;
    quoteDelayMinutes?: number;
    commissionCentsPerTrade?: number;
}

export function parseUpdateConfigRequest(raw: unknown): UpdateConfigRequest {
    if (!isRecord(raw)) throw new Error('invalid update config');
    const out: UpdateConfigRequest = {
        startingCashCents: requireInt(raw['startingCashCents'], 'startingCashCents'),
        startDate: requireInt(raw['startDate'], 'startDate'),
    };
    const provider = optionalString(raw['provider']);
    if (provider !== undefined) out.provider = provider;
    const delay = optionalInt(raw['quoteDelayMinutes']);
    if (delay !== undefined) out.quoteDelayMinutes = delay;
    const commission = optionalInt(raw['commissionCentsPerTrade']);
    if (commission !== undefined) out.commissionCentsPerTrade = commission;
    assertUpdateBounds(out);
    return out;
}

function assertUpdateBounds(out: UpdateConfigRequest): void {
    if (out.startingCashCents < 0) throw new Error('invalid startingCashCents');
    if (out.quoteDelayMinutes !== undefined && (out.quoteDelayMinutes < 0 || out.quoteDelayMinutes > 120))
        throw new Error('invalid quoteDelayMinutes');
    if (out.commissionCentsPerTrade !== undefined && out.commissionCentsPerTrade < 0)
        throw new Error('invalid commission');
}

export interface Trade {
    id: number;
    symbol: string;
    side: Side;
    qty: number;
    price: number;
    cashDeltaCents: number;
    mode: TradeMode;
    executedAt: number;
    createdAt: number;
}

export function parseTrade(raw: unknown): Trade {
    if (!isRecord(raw)) throw new Error('invalid trade');
    return {
        id: requireInt(raw['id'], 'trade id'),
        symbol: parseSymbol(raw['symbol']),
        side: parseSide(raw['side']),
        qty: parseQty(raw['qty']),
        price: requireNumber(raw['price'], 'trade price'),
        cashDeltaCents: requireInt(raw['cashDeltaCents'], 'cashDeltaCents'),
        mode: parseTradeMode(raw['mode']),
        executedAt: requireInt(raw['executedAt'], 'executedAt'),
        createdAt: requireInt(raw['createdAt'], 'createdAt'),
    };
}

export interface Order {
    id: number;
    symbol: string;
    side: Side;
    qty: number;
    executeAt: number;
    status: OrderStatus;
    createdAt: number;
    tradeId?: number | null;
    orderType: OrderType;
    tif: Tif;
    limitPrice?: number | null;
    stopPrice?: number | null;
    expiresAt?: number | null;
    fillPriceSource: FillPriceSource;
}

export function parseOrder(raw: unknown): Order {
    if (!isRecord(raw)) throw new Error('invalid order');
    const order: Order = {
        id: requireInt(raw['id'], 'order id'),
        symbol: parseSymbol(raw['symbol']),
        side: parseSide(raw['side']),
        qty: parseQty(raw['qty']),
        executeAt: requireInt(raw['executeAt'], 'executeAt'),
        status: parseOrderStatus(raw['status']),
        createdAt: requireInt(raw['createdAt'], 'createdAt'),
        orderType: raw['orderType'] === undefined ? 'market' : parseOrderType(raw['orderType']),
        tif: raw['tif'] === undefined ? 'GTC' : parseTif(raw['tif']),
        fillPriceSource: parseFillPriceSource(raw['fillPriceSource']),
    };
    applyOrderOptionals(order, raw);
    return order;
}

function applyOrderOptionals(order: Order, raw: Record<string, unknown>): void {
    applyTradeId(order, raw['tradeId']);
    applyLimitPrice(order, raw['limitPrice']);
    applyStopPrice(order, raw['stopPrice']);
    applyExpiresAt(order, raw['expiresAt']);
}

function applyTradeId(order: Order, tradeId: unknown): void {
    if (tradeId !== undefined && tradeId !== null) order.tradeId = requireInt(tradeId, 'tradeId');
    else if (tradeId === null) order.tradeId = null;
}

function applyLimitPrice(order: Order, limitPrice: unknown): void {
    if (limitPrice !== undefined && limitPrice !== null) {
        const n = asNumber(limitPrice);
        if (n === undefined) throw new Error('invalid limitPrice');
        order.limitPrice = n;
    } else if (limitPrice === null) order.limitPrice = null;
}

function applyStopPrice(order: Order, stopPrice: unknown): void {
    if (stopPrice !== undefined && stopPrice !== null) {
        const n = asNumber(stopPrice);
        if (n === undefined) throw new Error('invalid stopPrice');
        order.stopPrice = n;
    } else if (stopPrice === null) order.stopPrice = null;
}

function applyExpiresAt(order: Order, expiresAt: unknown): void {
    if (expiresAt !== undefined && expiresAt !== null) order.expiresAt = requireInt(expiresAt, 'expiresAt');
    else if (expiresAt === null) order.expiresAt = null;
}

export interface HoldingsEntry {
    symbol: string;
    name: string;
    qty: number;
    avgCostCents: number;
    costBasisCents: number;
    currentPrice: number;
    marketValueCents: number;
    unrealizedPnlCents: number;
    unrealizedPnlPct: number;
}

export function parseHoldingsEntry(raw: unknown): HoldingsEntry {
    if (!isRecord(raw)) throw new Error('invalid holdings entry');
    return {
        symbol: parseSymbol(raw['symbol']),
        name: requireString(raw['name'], 'holdings name'),
        qty: requireInt(raw['qty'], 'holdings qty'),
        avgCostCents: requireInt(raw['avgCostCents'], 'avgCostCents'),
        costBasisCents: requireInt(raw['costBasisCents'], 'costBasisCents'),
        currentPrice: requireNumber(raw['currentPrice'], 'currentPrice'),
        marketValueCents: requireInt(raw['marketValueCents'], 'marketValueCents'),
        unrealizedPnlCents: requireInt(raw['unrealizedPnlCents'], 'unrealizedPnlCents'),
        unrealizedPnlPct: requireNumber(raw['unrealizedPnlPct'], 'unrealizedPnlPct'),
    };
}

export interface PortfolioPoint {
    time: number;
    cashCents: number;
    holdingsCents: number;
    totalCents: number;
    gainCents: number;
}

export function parsePortfolioPoint(raw: unknown): PortfolioPoint {
    if (!isRecord(raw)) throw new Error('invalid portfolio point');
    return {
        time: requireInt(raw['time'], 'point time'),
        cashCents: requireInt(raw['cashCents'], 'cashCents'),
        holdingsCents: requireInt(raw['holdingsCents'], 'holdingsCents'),
        totalCents: requireInt(raw['totalCents'], 'totalCents'),
        gainCents: requireInt(raw['gainCents'], 'gainCents'),
    };
}

export interface PortfolioSeries {
    startingCashCents: number;
    startDate: number;
    endDate: number;
    totalReturnPct: number;
    points: PortfolioPoint[];
    totalGainCents: number;
}

export function parsePortfolioSeries(raw: unknown): PortfolioSeries {
    if (!isRecord(raw)) throw new Error('invalid portfolio series');
    const pointsRaw = raw['points'];
    if (!Array.isArray(pointsRaw)) throw new Error('invalid points');
    return {
        startingCashCents: requireInt(raw['startingCashCents'], 'startingCashCents'),
        startDate: requireInt(raw['startDate'], 'startDate'),
        endDate: requireInt(raw['endDate'], 'endDate'),
        totalReturnPct: requireNumber(raw['totalReturnPct'], 'totalReturnPct'),
        points: pointsRaw.map((p) => parsePortfolioPoint(p)),
        totalGainCents: requireInt(raw['totalGainCents'], 'totalGainCents'),
    };
}

export interface PlaceTradeRequest {
    symbol: string;
    side: Side;
    qty: number;
    at: number;
    orderType: OrderType;
    limitPrice?: number;
    stopPrice?: number;
}

export interface PlaceOrderRequest {
    symbol: string;
    side: Side;
    qty: number;
    executeAt?: number;
    orderType: OrderType;
    tif: Tif;
    limitPrice?: number;
    stopPrice?: number;
    fillPriceSource?: FillPriceSource;
}

function hasValidPrice(value: number | undefined | null): boolean {
    return value !== undefined && value !== null && typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function needsLimit(orderType: OrderType): boolean {
    return orderType === 'limit' || orderType === 'stopLimit';
}

function needsStop(orderType: OrderType): boolean {
    return orderType === 'stop' || orderType === 'stopLimit';
}

function assertOrderPrices(orderType: OrderType, limitPrice?: number | null, stopPrice?: number | null): void {
    assertRequiredPrice(orderType, limitPrice, stopPrice);
    assertProvidedPrice(limitPrice, 'limitPrice');
    assertProvidedPrice(stopPrice, 'stopPrice');
}

function assertRequiredPrice(
    orderType: OrderType,
    limitPrice: number | null | undefined,
    stopPrice: number | null | undefined,
): void {
    if (needsLimit(orderType) && !hasValidPrice(limitPrice)) throw new Error('limitPrice required for limit orders');
    if (needsStop(orderType) && !hasValidPrice(stopPrice)) throw new Error('stopPrice required for stop orders');
}

function assertProvidedPrice(value: number | null | undefined, label: string): void {
    if (value !== undefined && value !== null && !hasValidPrice(value)) throw new Error(`invalid ${label}`);
}

export function parsePlaceTradeRequest(raw: unknown): PlaceTradeRequest {
    if (!isRecord(raw)) throw new Error('invalid place trade request');
    const symbol = parseSymbol(raw['symbol']);
    const side = parseSide(raw['side']);
    const qty = parseQty(raw['qty']);
    const at = requireInt(raw['at'], 'at');
    const orderType = raw['orderType'] === undefined ? 'market' : parseOrderType(raw['orderType']);
    const limitPrice = raw['limitPrice'] === undefined ? undefined : (asNumber(raw['limitPrice']) ?? undefined);
    const stopPrice = raw['stopPrice'] === undefined ? undefined : (asNumber(raw['stopPrice']) ?? undefined);
    assertOrderPrices(orderType, limitPrice, stopPrice);
    const out: PlaceTradeRequest = { symbol, side, qty, at, orderType };
    if (limitPrice !== undefined) out.limitPrice = limitPrice;
    if (stopPrice !== undefined) out.stopPrice = stopPrice;
    return out;
}

export function parsePlaceOrderRequest(raw: unknown): PlaceOrderRequest {
    if (!isRecord(raw)) throw new Error('invalid place order request');
    return buildPlaceOrderRequest(raw);
}

// oxlint-disable-next-line complexity
function buildPlaceOrderRequest(raw: Record<string, unknown>): PlaceOrderRequest {
    const symbol = parseSymbol(raw['symbol']);
    const side = parseSide(raw['side']);
    const qty = parseQty(raw['qty']);
    const orderType = raw['orderType'] === undefined ? 'market' : parseOrderType(raw['orderType']);
    const tif = raw['tif'] === undefined ? 'GTC' : parseTif(raw['tif']);
    const limitPrice = raw['limitPrice'] === undefined ? undefined : (asNumber(raw['limitPrice']) ?? undefined);
    const stopPrice = raw['stopPrice'] === undefined ? undefined : (asNumber(raw['stopPrice']) ?? undefined);
    const fillPriceSource =
        raw['fillPriceSource'] === undefined ? undefined : parseFillPriceSource(raw['fillPriceSource']);
    const executeAt = raw['executeAt'] === undefined ? undefined : requireInt(raw['executeAt'], 'executeAt');
    assertOrderPrices(orderType, limitPrice, stopPrice);
    const out: PlaceOrderRequest = { symbol, side, qty, orderType, tif };
    if (executeAt !== undefined) out.executeAt = executeAt;
    if (limitPrice !== undefined) out.limitPrice = limitPrice;
    if (stopPrice !== undefined) out.stopPrice = stopPrice;
    if (fillPriceSource !== undefined) out.fillPriceSource = fillPriceSource;
    return out;
}

export function parseArray<T>(raw: unknown, parser: (item: unknown) => T): T[] {
    if (!Array.isArray(raw)) throw new Error('expected array');
    return raw.map((item) => parser(item));
}
