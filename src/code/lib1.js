export function getPrice(finance) {
  return (finance && finance.price) || 0;
}
export function getRevenue(finance) {
  return (finance && finance.revenue) || 0;
}
export function getProfit(finance) {
  return getPrice(finance) - getRevenue(finance);
}
