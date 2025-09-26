using rlink.DTO;

using System.Net.Sockets;
using System.Text.Json;

namespace rlink.DataTransfer
{
    public class RopeReceiver
    {
        public int[] Channels { get; private set; } = { 1000, 1000, 1000, 1000, 1000, 1500, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000 };


        public void Parse(byte[] buffer)
        {
            if (buffer.Length < 4)
                throw new ArgumentException("Buffer too small to contain length prefix");

            int length = BitConverter.ToInt32(buffer, 0);
            if (buffer.Length < 4 + length * 4)
                throw new ArgumentException("Incomplete data");

            Channels = new int[length];
            for (int i = 0; i < length; i++)
            {
                Channels[i] = BitConverter.ToInt32(buffer, 4 + i * 4);
            }
        }

        public void ParseJson(byte[] buffer)
        {
            try
            {

                var parsed = TryParseMessage(buffer, out var ropeMessage, out var message);
                if (parsed)
                {
                    switch (ropeMessage)
                    {
                        case ChannelUpdateRequest ch:
                            {
                                Channels = ch?.Channels ?? Array.Empty<int>();
                            };break;
                        case PingMessage pm: { }; break;

                    }
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("Failed to parse JSON", ex);
            }
        }

        public static bool TryParseMessage(byte[] buffer, out IRopeMessage? msg, out string? error)
        {
            msg = null;
            error = null;

            try
            {
                using var doc = JsonDocument.Parse(buffer);
                var root = doc.RootElement;

                string? type = root.TryGetProperty("type", out var typeEl) ? typeEl.GetString() : null;
                JsonElement payload = root.TryGetProperty("payload", out var p) ? p : root;

                if (string.IsNullOrWhiteSpace(type))
                {
                    error = "Missing 'type' field.";
                    return false;
                }

                switch (type)
                {
                    case "channels":
                        msg = payload.Deserialize<ChannelUpdateRequest>();
                        return msg is not null;

                    case "ping":
                        msg = payload.Deserialize<PingMessage>();
                        return msg is not null;

                    default:
                        error = $"Unknown message type '{type}'.";
                        return false;
                }
            }
            catch (JsonException ex)
            {
                error = $"Invalid JSON: {ex.Message}";
                return false;
            }
        }

        public async Task ReadAsync(NetworkStream stream, CancellationToken cancellationToken = default)
        {
            // Read 4-byte length prefix
            byte[] lengthBuffer = await ReadExactBytesAsync(stream, 4, cancellationToken);
            int length = BitConverter.ToInt32(lengthBuffer, 0);

            // Read (length * 4) bytes of data
            byte[] dataBuffer = await ReadExactBytesAsync(stream, length * 4, cancellationToken);

            // Parse to int[]
            Channels = new int[length];
            for (int i = 0; i < length; i++)
            {
                Channels[i] = BitConverter.ToInt32(dataBuffer, i * 4);
            }
        }

        internal void UpdateChannels(int[] channels)
        {
            if (channels == null || channels.Length != 16)
                throw new ArgumentException("Expected 16 channel values in the 'channels' array.");
            Channels = channels;
        }

        private async Task<byte[]> ReadExactBytesAsync(NetworkStream stream, int count, CancellationToken cancellationToken)
        {
            byte[] buffer = new byte[count];
            int offset = 0;

            while (offset < count)
            {
                int bytesRead = await stream.ReadAsync(buffer, offset, count - offset, cancellationToken);
                if (bytesRead == 0)
                {
                    throw new IOException("Stream closed before expected number of bytes were received.");
                }
                offset += bytesRead;
            }

            return buffer;
        }
    }

}
