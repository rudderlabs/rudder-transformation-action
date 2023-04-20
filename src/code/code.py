from getFinanceData14 import getRevenue, getPrice, getProfit
from getUserAddress14 import getCity, getCountry, getStreet

def transformEvent(events,metadata):
    return {
        'revenue': getRevenue(events.get('properties')),
        'price': getPrice(events.get('properties')),
        'profit': getProfit(events.get('properties')),
        'city': getCity(events.get('context', {}).get('traits', {}).get('address')),
        'country': getCountry(events.get('context', {}).get('traits', {}).get('address')),
        'street': getStreet(events.get('context', {}).get('traits', {}).get('address'))
    }
