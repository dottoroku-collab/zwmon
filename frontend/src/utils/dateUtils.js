/**
 * Centralized date handling utility for Telkom Ticketing System
 */

/**
 * Safely format a date string to Indonesian locale
 * @param {string|Date|null|undefined} dateStr
 * @param {object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date or '-'
 */
export const formatDate = (dateStr, options = {}) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options
    });
  } catch {
    return '-';
  }
};

/**
 * Format date only (no time)
 */
export const formatDateOnly = (dateStr) => {
  return formatDate(dateStr, { hour: undefined, minute: undefined });
};

/**
 * Format time only
 */
export const formatTimeOnly = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

/**
 * Get relative time (e.g., "5 menit lalu")
 */
export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;
    return formatDate(dateStr);
  } catch {
    return '-';
  }
};

/**
 * Calculate remaining time until SLA deadline
 * @returns {{ text: string, isBreached: boolean, urgency: 'ok'|'warning'|'critical' }}
 */
export const getSLAStatus = (deadlineStr) => {
  if (!deadlineStr) return { text: '-', isBreached: false, urgency: 'ok' };
  try {
    const deadline = new Date(deadlineStr);
    if (isNaN(deadline.getTime())) return { text: '-', isBreached: false, urgency: 'ok' };
    
    const now = new Date();
    const diff = deadline - now;
    
    if (diff <= 0) {
      const overMins = Math.abs(Math.floor(diff / 60000));
      const overHours = Math.floor(overMins / 60);
      return {
        text: overHours > 0 ? `Terlewat ${overHours}j ${overMins % 60}m` : `Terlewat ${overMins}m`,
        isBreached: true,
        urgency: 'critical'
      };
    }
    
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    
    if (hours < 1) {
      return { text: `${mins} menit lagi`, isBreached: false, urgency: 'critical' };
    }
    if (hours < 2) {
      return { text: `${hours}j ${mins % 60}m lagi`, isBreached: false, urgency: 'warning' };
    }
    return { text: `${hours}j ${mins % 60}m lagi`, isBreached: false, urgency: 'ok' };
  } catch {
    return { text: '-', isBreached: false, urgency: 'ok' };
  }
};

/**
 * Format duration in minutes to human-readable
 */
export const formatDuration = (minutes) => {
  if (minutes == null || minutes === 0) return '-';
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h}j ${m}m`;
};
