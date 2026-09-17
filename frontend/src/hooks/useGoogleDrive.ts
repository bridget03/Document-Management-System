import { useQuery } from '@tanstack/react-query';
import { driveStatus, driveLogs } from '../services/googleDriveApi';
export function useGoogleDrive() {
  const status = useQuery({ queryKey: ['drive-status'], queryFn: driveStatus });
  const logs = useQuery({ queryKey: ['drive-logs'], queryFn: driveLogs });
  return { status, logs };
}
