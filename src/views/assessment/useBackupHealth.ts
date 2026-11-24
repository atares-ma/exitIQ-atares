import { useEffect, useState } from 'react';
import { onBackupHealth, type BackupHealth } from '../../lib/remote';

/** Online backup health for views (see remote.onBackupHealth). */
export function useBackupHealth(): BackupHealth {
  const [h, set] = useState<BackupHealth>({ online: null });
  useEffect(() => onBackupHealth(set), []);
  return h;
}
