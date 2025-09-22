import { Box, Grid } from "@mui/joy"
import HealthCheck from "./HealthCheck"
import GamepadViewer from "./GamepadViewer"
import { useEffect, useRef, useState } from "react"
import { SocketConfig } from "./SocketConfig"

export default function Dashboard() {
  const [socketAddress, setSocketAddress] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const manuallyClosedRef = useRef<boolean>(false);
  const [isHealthy, setHealthy] = useState<boolean>(false);
  const [isStreamAvailable, setIsStreamAvailable] = useState<boolean>(false);


  const clearTimers = () => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const startHeartbeat = () => {
    clearTimers();
    heartbeatRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: "ping", payload: {} })); } catch { }
      }
    }, 5000);
  };

  const scheduleReconnect = () => {
    if (manuallyClosedRef.current) return; // don't auto-reconnect after unmount
    const delay = Math.min(backoffRef.current, 30000); // cap at 30s
    console.log(`Reconnecting WebSocket in ${delay} ms`);
    retryTimerRef.current = window.setTimeout(() => {
      connect();
    }, delay);
    backoffRef.current = Math.min(backoffRef.current * 2, 30000);
  };

  const connect = () => {
    if (!socketAddress) return;

    try {
      setIsStreamAvailable(false);
      wsRef.current?.close();
      wsRef.current = new WebSocket(socketAddress);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected");
        setHealthy(true);
        backoffRef.current = 1000;
        startHeartbeat();
      };

      wsRef.current.onmessage = (evt) => {
        console.log(evt);
      };

      wsRef.current.onerror = (err) => {
        console.error("WebSocket error:", err);
        try {
          wsRef.current?.close();
        } catch { }
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        setHealthy(false);
        clearTimers();
        scheduleReconnect();
      };
    }
    catch { }
  };


  useEffect(() => {
    if (!socketAddress) return;

    manuallyClosedRef.current = false;
    connect();

    const onOnline = () => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) connect();
    };
    window.addEventListener("online", onOnline);

    const onVisibility = () => {
      if (document.visibilityState === "visible" &&
        wsRef.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      manuallyClosedRef.current = true;
      clearTimers();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      try { wsRef.current?.close(); } catch { }
    };
  }, [socketAddress]);


  const sendMessage = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "channels",
        payload: { channels: data }
      }));
    } else {
      console.warn("WS not open; message dropped", data);
    }
  };

  const handleSocketChange = (addr: string) => {
    setSocketAddress(addr);
    console.log("Socket address changed: ", addr);
  }

  return (
    <Grid container spacing={2}>
      <Grid xs={6}>
        <Box
          sx={{
            height: 200,
            bgcolor: 'black',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'md',
          }}
        >

          <h1>ROPE v. 0.1</h1>
        </Box>
      </Grid>
      <Grid xs={6}>
        <Box
          sx={{
            height: 200,
            bgcolor: 'success.softBg',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'md',
          }}
        >
          <SocketConfig onChange={handleSocketChange} />
        </Box>
      </Grid>
      <Grid xs={12}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'md',
            height: '30px'
          }}
        >
          <HealthCheck title='Airwire' isHealthy={isHealthy} />
        </Box>
      </Grid>
      <Grid xs={6}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'gray',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            borderRadius: 'md',
          }}
        >
          <Box sx={{
            display: 'flex'
          }}>
            {socketAddress && <GamepadViewer sendMessage={sendMessage} />}
          </Box>
        </Box>
      </Grid>
      <Grid xs={6} sx={{ minHeight: 400 }}>
        <Box sx={{ position: 'relative', bgcolor: 'gray', height: '100%', minHeight: 520 }}>
          {isStreamAvailable && <Box
            component="iframe"
            src=""
            allow="autoplay; fullscreen"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              border: 0,
            }}
          />}
        </Box>
      </Grid>
    </Grid>
  )
}