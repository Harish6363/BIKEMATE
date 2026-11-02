/**
 * BikeMate - 12-Hour Time Utility
 * Standardizes all platform timelines to clear 12-hour format (e.g. "8:30 AM", "4:15 PM")
 */

export const format12Hour = (dateInput) => {
  if (!dateInput) return 'Today';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Today';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

export const formatTimeString12h = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':');
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m || '00'} ${ampm}`;
};
