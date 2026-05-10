import { CalendarEvent } from "../types";

export function generateWeekEvents(date: Date): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const today = new Date();
  
  events.push({
    id: "focus-today",
    title: "Focus 20: Income Lever Block",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30, 0, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 30, 0, 0),
    type: "focus",
    isFocusBlock: true,
  });

  events.push({
    id: "meeting-1",
    title: "Team standup",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 30, 0, 0),
    type: "meeting",
  });

  events.push({
    id: "meeting-2",
    title: "Product review",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0, 0, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 0, 0, 0),
    type: "meeting",
  });

  events.push({
    id: "personal-1",
    title: "Lunch",
    start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0),
    end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 13, 0, 0, 0),
    type: "personal",
  });

  return events;
}