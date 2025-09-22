import { useEffect, useRef } from 'react';

const WebSocketComponent = () => {
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Replace with your WebSocket server URL
    socketRef.current = new WebSocket('ws://localhost:8080');

    socketRef.current.onopen = () => {
      console.log('WebSocket connection opened');
    };

    socketRef.current.onmessage = (event) => {
      console.log('Received:', event.data);
    };

    socketRef.current.onclose = () => {
      console.log('WebSocket connection closed');
    };

    socketRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      socketRef.current?.close();
    };
  }, []);

  const sendData = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const data = JSON.stringify({ message: 'Hello from React!' });
      socketRef.current.send(data);
      console.log('Sent:', data);
    } else {
      console.warn('WebSocket is not open');
    }
  };

  return (
    <div>
      <button onClick={sendData}>Send Message</button>
    </div>
  );
};

export default WebSocketComponent;
