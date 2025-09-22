import { Box } from '@mui/joy';
import { useEffect, useState } from 'react';

type Props = {
  title: string | null; // e.g. "192.168.1.100:5000"
  isHealthy: boolean;
};

const HealthCheck = ({ title, isHealthy }: Props) => {
  const [status, setStatus] = useState<'checking' | 'healthy' | 'notHealthy'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        
        setStatus(isHealthy ? 'healthy' : 'notHealthy');
      } catch {
        setStatus('notHealthy');
      }
    };

    setStatus('checking');
    checkHealth();
  }, [isHealthy]);

  return (
    <Box width={300}>
      {title} Health: {status === 'checking' && '🔄'} {status === 'healthy' && '✅ Healthy'}{' '}
      {status === 'notHealthy' && '❌ Not Healthy'}
    </Box>
  );
};

export default HealthCheck;
