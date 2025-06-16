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

function formatDateForCalendar(dateStr: string) {
  // YYYY-MM-DD -> YYYYMMDD
  return dateStr.replace(/-/g, "");
}

function downloadICS(event: EventType) {
  const dt = formatDateForCalendar(event.date);
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${event.name}\nDESCRIPTION:${event.fullDescription.replace(/\n/g, ' ')}\nDTSTART;VALUE=DATE:${dt}\nDTEND;VALUE=DATE:${dt}\nEND:VEVENT\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.name.replace(/[^a-z0-9]/gi, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const EventCard: React.FC<EventCardProps> = ({ event, expanded, onExpand }) => {
  const imagePath = event.imageName
    ? `${process.env.PUBLIC_URL}/images/${event.imageName}`
    : "";

  // Google Calendar link
  const gcalDate = formatDateForCalendar(event.date);
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${gcalDate}/${gcalDate}&details=${encodeURIComponent(event.fullDescription)}`;

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
        {expanded && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }} onClick={e => e.stopPropagation()}>
            {/* Calendar icon */}
            <span style={{ display: 'flex', alignItems: 'center', fontSize: 22, color: '#0f5c6e' }} title="Add to calendar">
              <img src="/AstroLogs/images/icons/calendar-generic.png" alt="Calendar" width={24} height={24} style={{ display: 'block' }} />
            </span>
            {/* Apple button */}
            <button
              onClick={ev => { ev.stopPropagation(); downloadICS(event); }}
              style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Add to Apple Calendar (.ics)"
            >
              <img src="/AstroLogs/images/icons/apple.png" alt="Apple Calendar" width={24} height={24} />
            </button>
            {/* Outlook button */}
            <button
              onClick={ev => { ev.stopPropagation(); downloadICS(event); }}
              style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Add to Outlook (.ics)"
            >
              <img src="/AstroLogs/images/icons/outlook.png" alt="Outlook" width={24} height={24} />
            </button>
            {/* Google button */}
            <a
              href={gcalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
              title="Add to Google Calendar"
              onClick={e => e.stopPropagation()}
            >
              <img src="/AstroLogs/images/icons/google-calendar.png" alt="Google Calendar" width={24} height={24} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventCard;
