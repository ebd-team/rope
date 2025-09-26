public static class ChannelPacker
{
    // Pack N channels of 11-bit values (0..2047) into 22 bytes (16*11 = 176 bits)
    public static byte[] PackChannels(int[] channels)
    {
        const int BITS_PER_CH = 11;
        const int CH_COUNT = 16; // adjust if you use a different count

        // Normalize length and clamp values.
        var ch = new int[CH_COUNT];
        for (int i = 0; i < CH_COUNT; i++)
        {
            int v = (i < channels.Length) ? channels[i] : 0;
            if (v < 0) v = 0;
            if (v > 2047) v = 2047;
            ch[i] = v;
        }

        var bytes = new byte[(CH_COUNT * BITS_PER_CH + 7) / 8]; // 22
        int bitIndex = 0; // bit cursor across the whole buffer (LSB-first)

        for (int c = 0; c < CH_COUNT; c++)
        {
            int v = ch[c];
            for (int b = 0; b < BITS_PER_CH; b++, bitIndex++)
            {
                int byteIndex = bitIndex >> 3;      // /8
                int bitInByte = bitIndex & 0x7;     // %8 (LSB-first)
                if (((v >> b) & 1) != 0)
                    bytes[byteIndex] |= (byte)(1 << bitInByte);
            }
        }

        return bytes;
    }

    public static int[] UnpackChannels(byte[] data, int channelCount = 16)
    {
        const int BITS_PER_CH = 11;
        var res = new int[channelCount];
        int bitIndex = 0;

        for (int c = 0; c < channelCount; c++)
        {
            int v = 0;
            for (int b = 0; b < BITS_PER_CH; b++, bitIndex++)
            {
                int byteIndex = bitIndex >> 3;
                int bitInByte = bitIndex & 0x7;
                int bit = (data[byteIndex] >> bitInByte) & 1;
                v |= bit << b;
            }
            res[c] = v;
        }
        return res;
    }
}
