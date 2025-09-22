import { useState, useEffect } from 'react';
import { Input, Button, Typography, Box } from '@mui/joy';

const STORAGE_KEY = 'socketData';

type SocketConfigProps = {
  onChange?: (addr: string) => void;
};

export const SocketConfig = ({ onChange }: SocketConfigProps) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('');
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const [storedIp, storedPort, storedKey] = stored.split(':');
      setIp(storedIp);
      setPort(storedPort);
      setKey(storedKey);
    }
  }, []);

  const isValidIp = (ip: string) =>
    ip.toLowerCase() === 'localhost' ||
    (/^(\d{1,3}\.){3}\d{1,3}$/.test(ip) &&
      ip.split('.').every((num) => +num >= 0 && +num <= 255));
  

  const isValidPort = (port: string) =>
    /^\d{1,5}$/.test(port) && +port > 0 && +port <= 65535;

  const isValidKey = (port: string) =>
    true; // validate port ex. /^[^\s]{1,5}$/.test(port);
  

  const handleSave = () => {
    if (!isValidIp(ip)) return setError('Invalid IP address');
    if (!isValidPort(port)) return setError('Invalid port');
    if (!isValidKey(key)) return setError('Invalid key');
    const fullAddress = `ws://${ip}:${port}?connectionId=${key}`;
    localStorage.setItem(STORAGE_KEY, `${ip}:${port}:${key}`);
    setError('');
    onChange?.(fullAddress); // notify parent
  };

  return (
    <Box display="flex" flexDirection="column" gap={1} maxWidth={300}>
      
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
       <Input
        placeholder="Key"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      {error && <Typography color="danger">{error}</Typography>}
      <Button onClick={handleSave}>Connect</Button>
    </Box>
  );
};
