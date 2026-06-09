function getZonedParts(date = new Date(), timeZone = 'Europe/Paris') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
}

function getBusinessDate(date = new Date(), timeZone = 'Europe/Paris') {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

module.exports = { getZonedParts, getBusinessDate };
