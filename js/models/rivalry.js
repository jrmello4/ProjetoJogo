export class Rivalry {
  constructor(data) {
    this.id = data.id;
    this.fighterAId = data.fighterAId;
    this.fighterBId = data.fighterBId;
    this.intensity = data.intensity || 1;
    this.type = data.type || 'competitive';
    this.history = data.history || [];
    this.active = data.active !== false;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.createdAtAbsWeek = data.createdAtAbsWeek ?? null;
    this.lastHeatAbsWeek = data.lastHeatAbsWeek ?? this.createdAtAbsWeek;
  }

  increaseIntensity(amount = 1, atAbsWeek = null) {
    this.intensity = Math.min(10, this.intensity + amount);
    if (atAbsWeek != null) this.lastHeatAbsWeek = atAbsWeek;
  }

  addEvent(type, description) {
    this.history.push({
      type,
      description,
      date: new Date().toISOString(),
    });
    if (this.history.length > 20) {
      this.history = this.history.slice(-20);
    }
  }

  get intensityLabel() {
    if (this.intensity >= 9) return 'Fúria';
    if (this.intensity >= 7) return 'Intensa';
    if (this.intensity >= 4) return 'Moderada';
    return 'Leve';
  }
}
