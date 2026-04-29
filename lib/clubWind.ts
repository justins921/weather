// "Club wind": rough rule of thumb for how many extra clubs to take into
// account when picking. Based on sustained wind speed in mph.
export function clubsForWind(mph: number): number {
  if (mph < 6) return 0;
  if (mph <= 10) return 1;
  if (mph <= 15) return 1.5;
  if (mph <= 20) return 2;
  if (mph <= 25) return 2.5;
  if (mph <= 30) return 3;
  return 3.5; // "3+ clubs, conditions getting brutal"
}

export function formatClubs(clubs: number): string {
  if (clubs === 0) return 'No club';
  if (clubs === 0.5) return 'Half club';
  if (clubs === 1) return '1 club';
  if (clubs === 1.5) return '1.5 clubs';
  if (clubs === 2) return '2 clubs';
  if (clubs === 2.5) return '2.5 clubs';
  if (clubs === 3) return '3 clubs';
  return '3+ clubs';
}
