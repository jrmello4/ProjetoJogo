import { Event } from '../models/event.js';
import { DB } from '../services/db.js';
import { generateId } from '../utils/helpers.js';

export class EventController {
  constructor(db) {
    this.db = db;
  }

  async getAllEvents() {
    const data = await this.db.getAll('events');
    return data.map(d => new Event(d)).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getEvent(id) {
    const data = await this.db.get('events', id);
    return data ? new Event(data) : null;
  }

  async getUpcomingEvents() {
    const all = await this.getAllEvents();
    const now = new Date().toISOString();
    return all.filter(e => e.date >= now && e.status !== 'completed');
  }

  async getPastEvents() {
    const all = await this.getAllEvents();
    const now = new Date().toISOString();
    return all.filter(e => e.date < now || e.status === 'completed');
  }

  async createEvent(data) {
    const event = new Event({
      ...data,
      id: data.id || generateId(),
    });
    await this.db.add('events', event);
    return event;
  }

  async updateEvent(event) {
    await this.db.put('events', event);
  }

  async saveFightResult(result) {
    result.id = result.id || generateId();
    await this.db.add('fights', result);
  }

  async getFightHistory(fighterId) {
    const data = await this.db.getIndex('fights', 'fighterId', fighterId);
    return data.sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  async getEventFights(eventId) {
    const data = await this.db.getIndex('fights', 'eventId', eventId);
    return data;
  }

  async getAllFights() {
    const data = await this.db.getAll('fights');
    return data.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}
