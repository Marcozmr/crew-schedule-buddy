/** Códigos de tempo WMO (Open-Meteo) em português. */
const TABLE: Array<[number[], string, string]> = [
  [[0], 'Céu limpo', '☀️'],
  [[1], 'Predominantemente limpo', '🌤️'],
  [[2], 'Parcialmente nublado', '⛅'],
  [[3], 'Nublado', '☁️'],
  [[45, 48], 'Nevoeiro', '🌫️'],
  [[51, 53, 55], 'Garoa', '🌦️'],
  [[56, 57], 'Garoa congelante', '🌧️'],
  [[61, 63], 'Chuva', '🌧️'],
  [[65], 'Chuva forte', '🌧️'],
  [[66, 67], 'Chuva congelante', '🌧️'],
  [[71, 73, 75], 'Neve', '❄️'],
  [[77], 'Grãos de neve', '❄️'],
  [[80, 81], 'Pancadas de chuva', '🌦️'],
  [[82], 'Pancadas de chuva fortes', '⛈️'],
  [[85, 86], 'Pancadas de neve', '❄️'],
  [[95], 'Trovoada', '⛈️'],
  [[96, 99], 'Trovoada com granizo', '⛈️'],
];

export function wmoCondition(code: number): { label: string; emoji: string } {
  const row = TABLE.find(([codes]) => codes.includes(code));
  return row ? { label: row[1], emoji: row[2] } : { label: 'Desconhecido', emoji: '❓' };
}
