import React from "react";
import EventCard from "./EventCard";

function EventList({ events }) {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

export default EventList;
