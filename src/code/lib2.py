def getCity(address):
    return address.get("city", "no data found")

def getCountry(address):
    return address.get("country", "no data found")

def getStreet(address):
    return address.get("street", "no data found")
