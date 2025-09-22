export const getServerIp = (): string | null => {
    return localStorage.getItem('serverIp');
  };
  