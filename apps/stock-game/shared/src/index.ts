import { z } from 'zod';

export const SIDES = ['buy', 'sell', 'short', 'cover'] as const;
export const TRADE_MODES = ['backdated', 'scheduled'] as const;
export const ORDER_STATUSES = ['pending', 'filled', 'cancelled'] as const;
export const INTERVALS = ['1m', '5m', '15m', '30m', '60m', '1d', '1wk', '1mo'] as const;
export const ORDER_TYPES = ['market', 'limit', 'stop', 'stopLimit'] as const;
export const TIFS = ['DAY', 'GTC'] as const;

export const sideSchema = z.enum(SIDES);
export type Side = z.infer<typeof sideSchema>;

export const tradeModeSchema = z.enum(TRADE_MODES);
export type TradeMode = z.infer<typeof tradeModeSchema>;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const intervalSchema = z.enum(INTERVALS);
export type Interval = z.infer<typeof intervalSchema>;

export const orderTypeSchema = z.enum(ORDER_TYPES);
export type OrderType = z.infer<typeof orderTypeSchema>;

export const tifSchema = z.enum(TIFS);
export type Tif = z.infer<typeof tifSchema>;

export const symbolSchema = z.string().trim().toUpperCase().min(1).max(16);
export const qtySchema = z.number().int().positive();

export const symbolSearchResultSchema = z.object({
  symbol: symbolSchema,
  name: z.string(),
  exchange: z.string(),
  type: z.string(),
});
export type SymbolSearchResult = z.infer<typeof symbolSearchResultSchema>;

export const FILL_PRICE_SOURCES = ['last', 'bid', 'ask', 'mid'] as const
export const fillPriceSourceSchema = z.enum(FILL_PRICE_SOURCES)
export type FillPriceSource = z.infer<typeof fillPriceSourceSchema>

export function defaultFillPriceSource(side: Side): FillPriceSource {
  if (side === 'buy' || side === 'cover') return 'ask'
  return 'bid'
}

export const quoteSchema = z.object({
  symbol: symbolSchema,
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  exchange: z.string(),
  time: z.number().int(),
  delayMinutes: z.number().int().default(0),
  bid: z.number().positive().optional(),
  ask: z.number().positive().optional(),
});
export type Quote = z.infer<typeof quoteSchema>;

export const barSchema = z.object({
  time: z.number().int(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number().int(),
});
export type Bar = z.infer<typeof barSchema>;

export const gameConfigSchema = z.object({
  startingCashCents: z.number().int().nonnegative(),
  startDate: z.number().int(),
  provider: z.string(),
  quoteDelayMinutes: z.number().int().min(0).max(120).default(15),
  commissionCentsPerTrade: z.number().int().min(0).default(0),
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

export const updateConfigRequestSchema = z.object({
  startingCashCents: z.number().int().nonnegative(),
  startDate: z.number().int(),
  provider: z.string().optional(),
  quoteDelayMinutes: z.number().int().min(0).max(120).optional(),
  commissionCentsPerTrade: z.number().int().min(0).optional(),
});
export type UpdateConfigRequest = z.infer<typeof updateConfigRequestSchema>;

export const tradeSchema = z.object({
  id: z.number().int(),
  symbol: symbolSchema,
  side: sideSchema,
  qty: qtySchema,
  price: z.number(),
  cashDeltaCents: z.number().int(),
  mode: tradeModeSchema,
  executedAt: z.number().int(),
  createdAt: z.number().int(),
});
export type Trade = z.infer<typeof tradeSchema>;

export const orderSchema = z.object({
  id: z.number().int(),
  symbol: symbolSchema,
  side: sideSchema,
  qty: qtySchema,
  executeAt: z.number().int(),
  status: orderStatusSchema,
  createdAt: z.number().int(),
  tradeId: z.number().int().nullable(),
  orderType: orderTypeSchema,
  tif: tifSchema,
  limitPrice: z.number().nullable(),
  stopPrice: z.number().nullable(),
  expiresAt: z.number().int().nullable(),
  fillPriceSource: fillPriceSourceSchema,
});
export type Order = z.infer<typeof orderSchema>;

export const holdingsEntrySchema = z.object({
  symbol: symbolSchema,
  name: z.string(),
  qty: z.number().int(),
  avgCostCents: z.number().int(),
  costBasisCents: z.number().int(),
  currentPrice: z.number(),
  marketValueCents: z.number().int(),
  unrealizedPnlCents: z.number().int(),
  unrealizedPnlPct: z.number(),
});
export type HoldingsEntry = z.infer<typeof holdingsEntrySchema>;

export const portfolioPointSchema = z.object({
  time: z.number().int(),
  cashCents: z.number().int(),
  holdingsCents: z.number().int(),
  totalCents: z.number().int(),
  gainCents: z.number().int(),
});
export type PortfolioPoint = z.infer<typeof portfolioPointSchema>;

export const portfolioSeriesSchema = z.object({
  startingCashCents: z.number().int(),
  startDate: z.number().int(),
  endDate: z.number().int(),
  totalReturnPct: z.number(),
  points: z.array(portfolioPointSchema),
  totalGainCents: z.number().int(),
});
export type PortfolioSeries = z.infer<typeof portfolioSeriesSchema>;

function needsLimit(orderType: OrderType): boolean {
  return orderType === 'limit' || orderType === 'stopLimit'
}

function needsStop(orderType: OrderType): boolean {
  return orderType === 'stop' || orderType === 'stopLimit'
}

function hasValidPrice(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && value > 0
}

function assertOrderPrices(data: {
  orderType: OrderType;
  limitPrice?: number | null | undefined;
  stopPrice?: number | null | undefined;
}): boolean {
  if (needsLimit(data.orderType) && !hasValidPrice(data.limitPrice)) return false
  if (needsStop(data.orderType) && !hasValidPrice(data.stopPrice)) return false
  return true
}

function orderPriceIssue(ctx: z.RefinementCtx, orderType: OrderType): void {
  if (orderType === 'limit' || orderType === 'stopLimit') ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'limitPrice required for limit orders' });
  else ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stopPrice required for stop orders' });
}

function refineOrderPrices(data: { orderType: OrderType; limitPrice?: number | null | undefined; stopPrice?: number | null | undefined }, ctx: z.RefinementCtx): void {
  if (!assertOrderPrices(data)) orderPriceIssue(ctx, data.orderType);
}

export const placeTradeRequestSchema = z
  .object({
    symbol: symbolSchema,
    side: sideSchema,
    qty: qtySchema,
    at: z.number().int(),
    orderType: orderTypeSchema.default('market'),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => refineOrderPrices(data, ctx));
export type PlaceTradeRequest = z.input<typeof placeTradeRequestSchema>;

export const placeOrderRequestSchema = z
  .object({
    symbol: symbolSchema,
    side: sideSchema,
    qty: qtySchema,
    executeAt: z.number().int().optional(),
    orderType: orderTypeSchema.default('market'),
    tif: tifSchema.default('GTC'),
    limitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional(),
    fillPriceSource: fillPriceSourceSchema.optional(),
  })
  .superRefine((data, ctx) => refineOrderPrices(data, ctx));
export type PlaceOrderRequest = z.input<typeof placeOrderRequestSchema>;
