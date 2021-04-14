export function transformEvent(events) {
  if (events.context.address) events.context.address.street = "B1/6";
  return events;
}
