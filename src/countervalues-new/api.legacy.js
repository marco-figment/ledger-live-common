// @flow

import { findCurrencyByTicker } from "../currencies";
import { getEnv } from "../env";
import network from "../network";
import {
  magFromTo,
  formatPerGranularity,
  formatCounterValueDay,
} from "./helpers";
import type { CounterValuesAPI, RateMap } from "./types";

const baseURL = () => getEnv("LEDGER_COUNTERVALUES_API");

const legacyReverseRate = (from: string, to: string, rateMap: RateMap) => {
  const r = {};
  const fromC = findCurrencyByTicker(from);
  const toC = findCurrencyByTicker(to);
  if (!fromC || !toC) return {};
  Object.keys(rateMap).forEach((k) => {
    r[k] = rateMap[k] / magFromTo(fromC, toC);
  });
  return r;
};

const api: CounterValuesAPI = {
  fetchHistorical: async (granularity, { from, to, startDate }) => {
    const format = formatPerGranularity[granularity];
    const { data } = await network({
      method: "POST",
      url: `${baseURL()}/rates/${granularity}`,
      data: {
        pairs: [{ from, to, after: format(startDate) }],
      },
    });
    if (!data) return {};
    const toLevel = data[to];
    if (!toLevel) return {};
    const fromLevel = toLevel[from];
    if (!fromLevel || typeof fromLevel !== "object") return {};
    const [key] = Object.keys(fromLevel);
    const res: RateMap = legacyReverseRate(from, to, fromLevel[key]);
    delete res.latest;
    return res;
  },

  fetchLatest: async (pairs) => {
    const { data } = await network({
      method: "POST",
      url: `${baseURL()}/rates/daily`,
      data: {
        pairs: pairs.map((p) => ({
          ...p,
          after: formatCounterValueDay(new Date()),
        })),
      },
    });
    return pairs.map(({ from, to }) => {
      const fromTo = (data[to] || {})[from];
      if (!fromTo) return;
      const first = Object.values(fromTo)[0];
      if (!first || !first.latest) return;
      return legacyReverseRate(from, to, {
        latest: Number(first.latest),
      }).latest;
    });
  },

  fetchMarketcapTickers: async () => {
    const { data } = await network({
      method: "GET",
      url: `${baseURL()}/tickers`,
    });
    return data;
  },
};

export default api;