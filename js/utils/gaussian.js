export class Gaussian {
  static random(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z * stdDev + mean;
  }

  static clamp(min, max, mean = 0, stdDev = 1) {
    return Math.max(min, Math.min(max, Gaussian.random(mean, stdDev)));
  }

  static probability(playerScore, opponentScore) {
    const diff = playerScore - opponentScore;
    return 1 / (1 + Math.exp(-diff / 10));
  }
}
