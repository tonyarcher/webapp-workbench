import { z } from 'zod';

export const SIDES = ['buy', 'sell'] as const;
export const TRADE_MODES = ['backdated', 'scheduled'] as const;
export const ORDER_STATUSES = ['pending', 'filled', 'cancelled'] as const;
export const INTERVALS = ['1m', '5m', '15m', '30m', '60m', '1d', '1wk', '1mo'] as const;

export const sideSchema = z.enum(SIDES);
export type Side = z.infer<typeof sideSchema>;

export const tradeModeSchema = z.enum(TRADE_MODES);
export type TradeMode = z.infer<typeof tradeModeSchema>;

export const orderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const intervalSchema = z.enum(INTERVALS);
export type Interval = z.infer<typeof intervalSchema>;

export const symbolSchema = z.string().trim().toUpperCase().min(1).max(16);
export const qtySchema = z.number().int().positive();

export const symbolSearchResultSchema = z.object({
  symbol: symbolSchema,
  name: z.string(),
  exchange: z.string(),
  type: z.string(),
});
export type SymbolSearchResult = z.infer<typeof symbolSearchResultSchema>;

export const quoteSchema = z.object({
  symbol: symbolSchema,
  name: z.string(),
  price: z.number(),
  currency: z.string(),
  exchange: z.string(),
  time: z.number().int(),
  delayMinutes: z.number().int().default(0),
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
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

export const updateConfigRequestSchema = z.object({
  startingCashCents: z.number().int().nonnegative(),
  startDate: z.number().int(),
  provider: z.string().optional(),
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
});
export type PortfolioPoint = z.infer<typeof portfolioPointSchema>;

export const portfolioSeriesSchema = z.object({
  startingCashCents: z.number().int(),
  startDate: z.number().int(),
  endDate: z.number().int(),
  totalReturnPct: z.number(),
  points: z.array(portfolioPointSchema),
});
export type PortfolioSeries = z.infer<typeof portfolioSeriesSchema>;

export const placeTradeRequestSchema = z.object({
  symbol: symbolSchema,
  side: sideSchema,
  qty: qtySchema,
  at: z.number().int(),
});
export type PlaceTradeRequest = z.infer<typeof placeTradeRequestSchema>;

export const placeOrderRequestSchema = z.object({
  symbol: symbolSchema,
  side: sideSchema,
  qty: qtySchema,
  executeAt: z.number().int(),
});
export type PlaceOrderRequest = z.infer<typeof placeOrderRequestSchema>;
