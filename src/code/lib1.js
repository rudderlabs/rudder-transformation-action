export function getPrice(finance) {
    return Number(finance.price || 0);
  }
  export function getRevenue(finance) {
    return Number(finance.revenue || 0);
  }
  export function getProfit(finance) {
    return getPrice(finance) - getRevenue(finance);
  }