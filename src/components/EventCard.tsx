import React from "react";

export interface EventType {
  id: string;
  name: string;
  date: string;
  description: string;
  imageName: string;
  fullDescription: string;
}

interface EventCardProps {
  event: EventType;
  expanded: boolean;
  onExpand: () => void;
}

function formatEventDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const EventCard: React.FC<EventCardProps> = ({ event, expanded, onExpand }) => {
  const imagePath = event.imageName
    ? `${process.env.PUBLIC_URL}/images/${event.imageName}`
    : "";

  return (
    <div
      style={{
        background: "#222",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 24,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
        border: expanded ? "2px solid #0f5c6e" : "none",
        transition: "border 0.2s"
      }}
      onClick={onExpand}
    >
      {imagePath && (
        <img
          src={imagePath}
          alt={event.name}
          style={{
            width: "100%",
            height: 150,
            objectFit: "cover",
          }}
          onError={e => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
      <div style={{ padding: 16 }}>
        <div style={{ color: "#aaa", fontSize: 14, marginBottom: 4 }}>
          {formatEventDate(event.date)}
        </div>
        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
          {event.name}
        </div>
        <div style={{ marginTop: 8, color: "#ddd" }}>
          {expanded
            ? (event.fullDescription || "No data available.")
            : (event.description || "No data available.")}
        </div>
        <div style={{ marginTop: 8, color: "#0f5c6e", fontWeight: 500, fontSize: 13 }}>
          {expanded ? "Click to collapse" : "Click to expand"}
        </div>
      </div>
    </div>
  );
};

export default EventCard;
