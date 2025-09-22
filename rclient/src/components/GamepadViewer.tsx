import { Box } from '@mui/joy';
import { useEffect, useRef, useState } from 'react';

interface GamepadState {
    [index: number]: Gamepad;
}

type GamepadViewerProps = {
    sendMessage: any | null
};

// const mockGamepad: Gamepad = {
//     id: 'Mock Gamepad 1',
//     index: 0,
//     connected: true,
//     mapping: 'standard',
//     axes: [0.0, -0.5, 0.5, 1.0],
//     buttons: [
//         { pressed: false, touched: false, value: 0 },
//         { pressed: true, touched: true, value: 1 },
//         { pressed: false, touched: false, value: 0.5 },
//     ],
//     timestamp: Date.now(),
//     vibrationActuator: undefined as unknown as GamepadHapticActuator
// };

// const mappings: Record<string, number[]> = {
//     "default": [0, 1, 2, 3, 4, 5, 6, 7],
//     "Logitech Extreme 3D": [2, 0, 1, 3, 4, 5, 6, 7],
//     "Xbox Wireless Controller": [0, 1, 2, 3, 4, 5, 6, 7]
// };

// Example: CH1–CH4 from axes 0..3; CH5 const mid; CH6 from axis 6;
// CH7..CH9 from buttons 1,2,3; others default 998
const channelMap: ChannelSource[] = [
    { kind: 'axis', index: 0, name: "тур" },                // CH1
    { kind: 'axis', index: 1, invert: true, name: "тур" },  // CH2
    { kind: 'axis', index: 2, name: "pow" },                // CH3
    { kind: 'axis', index: 3, name: "блнс" },               // CH4
    { kind: 'axis', index: 6, name: "реле 0" },             // CH5
    { kind: 'axis', index: 5, name: "клбр" },               // CH6  <-- axis 6
    { kind: 'button', index: 1, name: "рв L" },             // CH7  <-- button 1
    { kind: 'button', index: 2, name: "рв R" },             // CH8  <-- button 2
    { kind: 'const', value:2000, name: "рл1" },             // CH9
    { kind: 'const', value:2000, name: "?" },               // CH10  <-- button 3
];


type ChannelSource =
    | { kind: 'axis'; index: number; invert?: boolean; deadzone?: number; name: string; }
    | { kind: 'button'; index: number; high?: number; low?: number; threshold?: number; name: string; }
    | { kind: 'const'; value: number; name: string; };

function applyDeadzone(x: number, dz = 0.08) {
    if (Math.abs(x) < dz) return 0;
    return (Math.abs(x) - dz) / (1 - dz) * Math.sign(x);
}


function GamepadViewer({ sendMessage }: GamepadViewerProps) {

    const lastSentRef = useRef<number[]>([]);
    const lastSendTimeRef = useRef<number>(0);
    const sendIntervalMs = 100;

    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [controllers, setControllers] = useState<GamepadState>({});
    const requestRef = useRef<number>(null);

    function buildChannels(gp: Gamepad, channelMap: ChannelSource[], total = 16): number[] {
        const out: number[] = [];

        for (let ch = 0; ch < channelMap.length; ch++) {

            console.debug(channelMap.length);
            const src = channelMap[ch];
            if (!src) { out[ch] = 998; continue; }

            if (src.kind === 'axis') {
                const raw = gp.axes[src.index] ?? 0;
                let v = applyDeadzone(raw, src.deadzone ?? 0.08);
                if (src.invert) v = -v;
                out[ch] = mapAxisToPwm(v);
            } else if (src.kind === 'button') {
                const b = gp.buttons[src.index];
                const pressed = !!b && (b.pressed || b.value >= (src.threshold ?? 0.95));
                out[ch] = pressed ? (src.high ?? 2000) : (src.low ?? 1000);
            } else if (src.kind === 'const') {
                out[ch] = src.value;
            }
        }

        // pad to total channels
        while (out.length < total) out.push(998);
        return out;
    }



    function mapAxisToPwm(value: number): number {
        const midPwm = 1500;

        return Math.round(midPwm + value * 500); // -1 to 1 mapped to ±500

    }

    useEffect(() => {
        if (selectedIndex === null) return;

        let running = true;

        const loop = () => {
            if (!running) return;

            const gamepads = navigator.getGamepads();
            const gp = gamepads[selectedIndex];
            if (gp && gp.connected) {
                const channels = buildChannels(gp, channelMap, 16);

                while (channels.length < 16) channels.push(998);

                const now = performance.now();
                const changed = channels.some(
                    (v, i) => Math.abs(v - (lastSentRef.current[i] ?? 998)) > 3
                );

                if (changed && now - lastSendTimeRef.current > sendIntervalMs) {
                    lastSendTimeRef.current = now;
                    lastSentRef.current = channels;

                    sendMessage(channels);
                }

                setControllers(prev => ({ ...prev, [gp.index]: gp }));
            }

            requestRef.current = requestAnimationFrame(loop);
        };

        requestRef.current = requestAnimationFrame(loop);

        return () => {
            running = false;
            cancelAnimationFrame(requestRef.current!);
        };
    }, [selectedIndex]);


    const connectHandler = (e: GamepadEvent) => {
        const gp = e.gamepad;
        setControllers((prev) => ({
            ...prev,
            [gp.index]: gp,
        }));

        if (selectedIndex === null) {
            setSelectedIndex(gp.index);
        }
    };

    const disconnectHandler = (e: GamepadEvent) => {
        const idx = e.gamepad.index;
        setControllers((prev) => {
            const copy = { ...prev };
            delete copy[idx];
            return copy;
        });
    };

    useEffect(() => {
        setControllers((prev) => ({
            ...prev,
            // [0]: mockGamepad,
        }));
    }, [])

    useEffect(() => {
        window.addEventListener('gamepadconnected', connectHandler);
        window.addEventListener('gamepaddisconnected', disconnectHandler);


        const fallbackScan = setInterval(() => {
            const gps = navigator.getGamepads();
            for (let i = 0; i < gps.length; i++) {
                const gp = gps[i];
                if (gp && !(gp.index in controllers)) {
                    connectHandler({ gamepad: gp } as GamepadEvent); 
                }
            }
        }, 500);

        return () => {
            window.removeEventListener('gamepadconnected', connectHandler);
            window.removeEventListener('gamepaddisconnected', disconnectHandler);
            cancelAnimationFrame(requestRef.current!);
            clearInterval(fallbackScan);
        };
    }, []);

    // useEffect(() => {
    //     if (!socketAddress) return;

    //     wsRef.current = new WebSocket(socketAddress); // Or ws://ip:port/path

    //     wsRef.current.onopen = () => console.log('WebSocket connected');
    //     wsRef.current.onclose = () => console.log('WebSocket disconnected');
    //     wsRef.current.onerror = (err) => console.error('WebSocket error:', err);

    //     return () => {
    //         wsRef.current?.close();
    //     };
    // }, [socketAddress]);

    var channels: number[];
    if (selectedIndex != null) {
        const gp = controllers[selectedIndex];
        if (gp != null) {

            channels = buildChannels(gp, channelMap, 16);
        }
    }

    return (
        <Box>
            <select
                value={selectedIndex ?? ''}
                onChange={(e) => setSelectedIndex(Number(e.target.value))}
            >
                <option value="">Select Controller</option>
                {Object.entries(controllers).map(([index, gp]) => (
                    <option key={index} value={index}>
                        {gp.id}
                    </option>
                ))}
            </select>
            {Object.entries(controllers).map(([index, gp]) => (
                <div
                    key={index}
                    id={`controller${index}`}
                    style={{ padding: 5 }}
                >
                    <h2>{gp.id}</h2>

                    <div className="buttons" style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {gp.buttons.map((btn: GamepadButton, i: number) => {
                            const pressed = typeof btn === 'object' ? btn.pressed : btn === 1.0;
                            const touched = typeof btn === 'object' ? btn.touched : false;
                            // const value = typeof btn === 'object' ? btn.value : btn;

                            return (
                                <span
                                    key={i}
                                    style={{
                                        width: 20,
                                        height: 20,
                                        margin: 3,
                                        background: pressed ? '#4caf50' : touched ? '#ffc107' : '#eee',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderRadius: 4,
                                        border: '1px solid #999',
                                        color: 'black',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    {i}
                                </span>
                            );
                        })}
                    </div>

                    <div className="axes" style={{ marginTop: 10 }}>
                        {gp.axes.map((axis: number, i: number) => (
                            <div key={i}>
                                Axis {i}: {axis.toFixed(4)}
                                <meter min={-1} max={1} value={axis} style={{ width: '100%' }} />
                            </div>
                        ))}
                    </div>
                    <div className="buttons" style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {channels.map((value: number, key: number) => {

                            return (
                                <Box
                                sx={{
                                  width: 36,                   
                                  p: 0.5,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  borderRadius: 'sm',
                                }}
                              >
                                <span style={{ display: 'block', fontSize: 13, height: 18, lineHeight: '18px' }}>
                                  CH{key + 1}
                                </span>
                              
                                {/* Fixed-height name slot; render nbsp if missing */}
                                <span
                                  style={{
                                    display: 'block',
                                    height: 22,
                                    lineHeight: '18px',
                                    width: '100%',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    color: 'black',
                                  }}
                                >
                                  {channelMap[key]?.name ?? '\u00A0'}
                                </span>
                              
                                <span
                                  style={{
                                    width: 34,
                                    height: 34,
                                    margin: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: 4,
                                    border: '1px solid #999',
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {value}
                                </span>
                              </Box>
                              
                            );
                        })}
                    </div>
                </div>
            ))}
        </Box>
    );
};

export default GamepadViewer;
