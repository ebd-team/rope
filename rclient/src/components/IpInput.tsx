import { useState, useEffect } from 'react';
import { Input, Button, Typography, Box } from '@mui/joy';

const STORAGE_KEY = 'serverIp';

type IpInputProps = {
  onChange?: (ip: string) => void;
};

export const IpInput = ({ onChange }: IpInputProps) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const [storedIp, storedPort] = stored.split(':');
      setIp(storedIp);
      setPort(storedPort);
    }
  }, []);

  const isValidIp = (ip: string) =>
    /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
    ip.split('.').every((num) => +num >= 0 && +num <= 255);

  const isValidPort = (port: string) =>
    /^\d{1,5}$/.test(port) && +port > 0 && +port <= 65535;

  const handleSave = () => {
    if (!isValidIp(ip)) return setError('Invalid IP address');
    if (!isValidPort(port)) return setError('Invalid port');
    const fullAddress = `${ip}:${port}`;
    localStorage.setItem(STORAGE_KEY, fullAddress);
    setError('');
    onChange?.(fullAddress); // notify parent
  };

  return (
    <Box display="flex" flexDirection="column" gap={1} maxWidth={300}>
      <Typography level="title-md">Server IP and Port</Typography>
      <Input
        placeholder="IP Address (e.g. 192.168.1.100)"
        value={ip}
        onChange={(e) => setIp(e.target.value)}
      />
      <Input
        placeholder="Port (e.g. 8000)"
        value={port}
        onChange={(e) => setPort(e.target.value)}
      />
      {error && <Typography color="danger">{error}</Typography>}
      <Button onClick={handleSave}>Save</Button>
    </Box>
  );
};
