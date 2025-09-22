import { Box } from '@mui/joy';
import { useEffect, useState } from 'react';

type Props = {
  ipAddress: string | null; // e.g. "192.168.1.100:5000"
};

const HealthIpCheck = ({ ipAddress }: Props) => {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`http://${ipAddress}/health`, {
          method: 'GET',
        });
        setStatus(response.ok ? 'online' : 'offline');
      } catch {
        setStatus('offline');
      }
    };

    setStatus('checking');
    checkHealth();
  }, [ipAddress]);

  return (
    <Box width={200}>
      Health: {status === 'checking' && '🔄'} {status === 'online' && '✅ Online'}{' '}
      {status === 'offline' && '❌ Offline'}
    </Box>
  );
};

export default HealthIpCheck;
