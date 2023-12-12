export function getCity(address) {
    return (address && address.city) || "no data found";
  }
  export function getCountry(address) {
    return (address && address.country) || "no data found";
  }
  export function getStreet(address) {
    return (address && address.street) || "no data found";
  }