using System.Text.Json.Serialization;

namespace rlink.DTO
{
    public class ChannelUpdateRequest : IRopeMessage
    {
        [JsonPropertyName("channels")]
        public int[] Channels { get; set; } = Array.Empty<int>();
    }

}
