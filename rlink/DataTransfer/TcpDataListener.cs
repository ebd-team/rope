namespace rlink.DataTransfer
{
    using System;
    using System.Net;
    using System.Net.Sockets;
    using System.Threading;
    using System.Threading.Tasks;

    public class TcpDataListener
    {
        private readonly int _port;
        private TcpClient _listener;
        public event Action<byte[]>? DataReceived;


        DateTime _lastDataReceivedAt = DateTime.MinValue;

        public bool IsConnectionActive => (DateTime.UtcNow - _lastDataReceivedAt) < TimeSpan.FromSeconds(6);

        public TcpDataListener(int port)
        {
            _port = port;

            _listener = new TcpClient();
        }

        public async Task StartAsync(CancellationToken cancellationToken = default)
        {
            await _listener.ConnectAsync(IPAddress.Loopback, _port);
            Log("[TcpClient] Connected to server");

            using NetworkStream stream = _listener.GetStream();
            byte[] buffer = new byte[1024];

            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    int bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, cancellationToken);

                    if (bytesRead == 0)
                    {
                        Log("[TcpClient] Server closed the connection.");
                        break;
                    }

                    //string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                    //Log($"[TcpClient] Received: {message}");

                    byte[] received = buffer[..bytesRead];
                    _lastDataReceivedAt = DateTime.UtcNow;
                    DataReceived?.Invoke(received);
                }
            }
            catch (OperationCanceledException)
            {
                Log("[TcpClient] Cancelled.");
            }
            catch (Exception ex)
            {
                Log($"[TcpClient] Error: {ex.Message}");
            }
        }

        private void Log(string message)
        {
            Console.WriteLine($"{DateTime.Now:yyyy-MM-dd HH:mm:ss.fff} {message}");
        }

        public void Stop()
        {
            _listener?.Close();
            Console.WriteLine("[TcpDataListener] Listener stopped.");
        }
    }
}
