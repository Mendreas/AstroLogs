import React, { useState } from "react";
import EventCard from "./EventCard";

interface EventType {
  id: string;
  name: string;
  date: string;
  description: string;
  imageName: string;
  fullDescription: string;
}

interface EventListProps {
  events: EventType[];
}

const EventList: React.FC<EventListProps> = ({ events }) => {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = events.filter(event =>
    event.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <input
        type="text"
        placeholder="Search events..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", marginBottom: 16, padding: 8, borderRadius: 6, border: "1px solid #444", background: "#181c23", color: "#fff" }}
      />
      {filtered.map(event => (
        <EventCard
          key={event.id}
          event={event}
          expanded={expandedId === event.id}
          onExpand={() => setExpandedId(expandedId === event.id ? null : event.id)}
        />
      ))}
      {filtered.length === 0 && (
        <div style={{ color: "#aaa", textAlign: "center", marginTop: 32 }}>No events found.</div>
      )}
    </div>
  );
};

export default EventList;
