def getPrice(finance):
    return finance.get('price', 0) if finance else 0

def getRevenue(finance):
    return finance.get('revenue', 0) if finance else 0

def getProfit(finance):
    return (float)getPrice(finance) - (float)getRevenue(finance)
