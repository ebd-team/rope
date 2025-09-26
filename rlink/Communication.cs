using rlink;
using rlink.Utils;

using System.IO.Ports;

public class Communication
{
    private SerialPort _serial;
    private byte[] _message;
    private byte[] _received;
    private string _portName;
    private int _baudRate;

    public bool IsConnected => _serial != null && _serial.IsOpen;
    public TelemetryData LatestTelemetry { get; private set; } = new TelemetryData();
    public Communication(string portName, int baudRate)
    {
        _portName = portName;
        _baudRate = baudRate;

        _message = Array.Empty<byte>();
        _received = new byte[0];

        _serial = new SerialPort(_portName, _baudRate);
    }

    public void Connect()
    {
        _serial.Open();
        Console.WriteLine("Serial port opened");
    }

    public void UpdateData(int[] pwm)
    {
        var ticks = PwmUtils.UsToTicks(pwm);
        var packed = ChannelPacker.PackChannels(ticks);

        var crcGen = new Crc8();
        var payloadWithType = new byte[1 + packed.Length];
        payloadWithType[0] = 0x16;
        Array.Copy(packed, 0, payloadWithType, 1, packed.Length);
        crcGen.Update(payloadWithType);

        byte crc = crcGen.Digest();

        //var msg = new List<byte> { 0xEE, 0x18, 0x16 }; Broadcast
        var msg = new List<byte> { 0xC8, 0x18, 0x16 }; // TX -> RX
        msg.AddRange(packed);
        msg.Add(crc);

        _message = msg.ToArray();
    }

    public void SendFrame() => _serial.Write(_message, 0, _message.Length);

    public void ReadTelemetry()
    {
        int available = _serial.BytesToRead;
        if (available > 0)
        {
            var buffer = new byte[available];
            _serial.Read(buffer, 0, available);
            _received = buffer;
        }
    }

    public void DecodeTelemetry()
    {
        if (_received == null || _received.Length < 5) return;

        for (int i = 0; i < _received.Length - 5; i++)
        {
            if (_received[i] == 0xEA && _received[i + 2] == 0x08)
            {
                int voltage = (_received[i + 3] << 8) | _received[i + 4];
                LatestTelemetry.VoltageRaw = voltage;
                Console.WriteLine($"Voltage: {LatestTelemetry.VoltageV:F2} V");
                break;
            }
        }

        _received = null;
    }
}
