import { getRevenue, getPrice, getProfit } from "getFinanceData";
import { getCity, getCountry, getStreet } from "getUserAddress";
export function transformEvent(events) {
  return {
    revenue: getRevenue(events.properties),
    price: getPrice(events.properties),
    profit: getProfit(events.properties),
    city: getCity(
      (events.context &&
        events.context.traits &&
        events.context.traits.address) ||
        {}
    ),
    country: getCountry(
      (events.context &&
        events.context.traits &&
        events.context.traits.address) ||
        {}
    ),
    street: getStreet(
      (events.context &&
        events.context.traits &&
        events.context.traits.address) ||
        {}
    )
  };
}
