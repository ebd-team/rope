using System;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

namespace rlink.DataTransfer
{
    public class TcpDateSender : IDisposable
    {
        private readonly string _host;
        private readonly int _port;
        private TcpClient? _client;
        private NetworkStream? _stream;

        public TcpDateSender(string host, int port)
        {
            _host = host;
            _port = port;
        }

        public async Task ConnectAsync()
        {
            try
            {
                _client = new TcpClient();
                await _client.ConnectAsync(_host, _port);
                _stream = _client.GetStream();
                Console.WriteLine($"Connected to {_host}:{_port}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TcpDateSender] Connection error: {ex.Message}");
            }
        }

        public async Task SendCurrentDateAsync()
        {
            try
            {
                if (_client == null || _stream == null || !_client.Connected)
                {
                    Console.WriteLine("[TcpDateSender] Not connected.");
                    return;
                }

                string dateString = DateTime.UtcNow.ToString("o") + "\n";
                byte[] data = Encoding.UTF8.GetBytes(dateString);
                await _stream.WriteAsync(data, 0, data.Length);
                Console.WriteLine($"[TcpDateSender] Sent: {dateString.Trim()}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TcpDateSender] Send error: {ex.Message}");
            }
        }

        public void Dispose()
        {
            _stream?.Dispose();
            _client?.Close();
            _client?.Dispose();
        }
    }
}
