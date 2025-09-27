/**
 * Utilities et formatters pour Pipeline V6
 * Fonctions utilitaires pour formatage et conversion
 */

/**
 * Formate une taille en bytes en format lisible
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Formate une durée en millisecondes en format lisible
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;

  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

/**
 * Formate un temps estimé restant
 */
export function formatTimeRemaining(ms?: number): string {
  if (!ms || ms <= 0) return 'Calcul en cours...';

  if (ms < 10000) return 'Quelques secondes';
  if (ms < 60000) return `~${Math.ceil(ms / 1000)}s`;
  if (ms < 300000) return `~${Math.ceil(ms / 60000)}min`;

  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `~${minutes}min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `~${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
}

/**
 * Formate un nombre avec séparateurs
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

/**
 * Formate un pourcentage
 */
export function formatPercentage(value: number, total: number, decimals = 1): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Formate une confidence score en couleur et texte
 */
export function formatConfidence(confidence: number): {
  text: string;
  color: string;
  bgColor: string;
} {
  if (confidence >= 0.9) {
    return {
      text: 'Très élevée',
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    };
  } else if (confidence >= 0.7) {
    return {
      text: 'Élevée',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    };
  } else if (confidence >= 0.5) {
    return {
      text: 'Moyenne',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    };
  } else if (confidence >= 0.3) {
    return {
      text: 'Faible',
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    };
  } else {
    return {
      text: 'Très faible',
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    };
  }
}

/**
 * Tronque un texte avec ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Tronque un chemin de fichier intelligemment
 */
export function truncatePath(path: string, maxLength = 50): string {
  if (path.length <= maxLength) return path;

  const parts = path.split(/[/\\]/);
  if (parts.length <= 2) return truncateText(path, maxLength);

  const fileName = parts[parts.length - 1];
  const firstPart = parts[0];

  if (fileName.length + firstPart.length + 5 >= maxLength) {
    return `${firstPart}/.../${truncateText(fileName, maxLength - firstPart.length - 5)}`;
  }

  return `${firstPart}/.../${fileName}`;
}

/**
 * Formate une date au format français
 */
export function formatDate(timestamp: number | Date): string {
  const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  return date.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formate une date relative (il y a X minutes/heures/jours)
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'À l\'instant';
  if (diff < 3600000) return `Il y a ${Math.floor(diff / 60000)}min`;
  if (diff < 86400000) return `Il y a ${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `Il y a ${Math.floor(diff / 86400000)}j`;

  return new Date(timestamp).toLocaleDateString('fr-FR');
}

/**
 * Génère une couleur basée sur un string (pour icônes, badges, etc.)
 */
export function generateColorFromString(str: string): {
  bg: string;
  text: string;
  border: string;
} {
  const colors = [
    { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
    { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
    { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200' },
    { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
    { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' }
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Calcule la vitesse de traitement
 */
export function calculateSpeed(itemsProcessed: number, timeElapsedMs: number): string {
  if (timeElapsedMs === 0) return '0 items/s';

  const itemsPerSecond = (itemsProcessed / timeElapsedMs) * 1000;

  if (itemsPerSecond < 1) {
    return `${(itemsPerSecond * 60).toFixed(1)} items/min`;
  } else if (itemsPerSecond < 100) {
    return `${itemsPerSecond.toFixed(1)} items/s`;
  } else {
    return `${Math.round(itemsPerSecond)} items/s`;
  }
}

/**
 * Calcule l'ETA basé sur le progrès actuel
 */
export function calculateETA(
  totalItems: number,
  processedItems: number,
  startTime: number
): number | null {
  if (processedItems === 0) return null;

  const elapsedTime = Date.now() - startTime;
  const itemsPerMs = processedItems / elapsedTime;
  const remainingItems = totalItems - processedItems;

  return remainingItems / itemsPerMs;
}

/**
 * Valide si un nom de fichier/dossier est valide
 */
export function validateFileName(name: string): { valid: boolean; error?: string } {
  if (!name.trim()) {
    return { valid: false, error: 'Le nom ne peut pas être vide' };
  }

  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(name)) {
    return { valid: false, error: 'Le nom contient des caractères invalides' };
  }

  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reservedNames.includes(name.toUpperCase())) {
    return { valid: false, error: 'Ce nom est réservé par le système' };
  }

  if (name.length > 255) {
    return { valid: false, error: 'Le nom est trop long (max 255 caractères)' };
  }

  return { valid: true };
}

/**
 * Nettoie un nom de fichier/dossier
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 255);
}

/**
 * Formate les types de fichiers détectés
 */
export function formatFileTypes(fileTypes: Record<string, number>): Array<{
  extension: string;
  count: number;
  percentage: number;
}> {
  const total = Object.values(fileTypes).reduce((sum, count) => sum + count, 0);

  return Object.entries(fileTypes)
    .map(([ext, count]) => ({
      extension: ext,
      count,
      percentage: (count / total) * 100
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Génère un ID unique simple
 */
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Debounce une fonction
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle une fonction
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}