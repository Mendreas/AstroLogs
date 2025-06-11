import React from "react";

function formatEventDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function EventCard({ event }) {
  return (
    <div
      style={{
        background: "#222",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <img
        src={process.env.PUBLIC_URL + "/images/" + event.imageName}
        alt={event.name}
        style={{
          width: "100%",
          height: 150,
          objectFit: "cover",
        }}
      />
      <div style={{ padding: 16 }}>
        <div style={{ color: "#aaa", fontSize: 14, marginBottom: 4 }}>
          {formatEventDate(event.date)}
        </div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
          {event.name}
        </div>
        {event.description && (
          <div style={{ marginTop: 8, color: "#ddd" }}>
            {event.description}
          </div>
        )}
      </div>
    </div>
  );
}

export default EventCard;
