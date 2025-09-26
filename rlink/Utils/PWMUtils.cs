namespace rlink.Utils
{
    public static class PwmUtils
    {
        public static int[] UsToTicks(int[] pwmValues)
        {
            return pwmValues.Select(pwm => (int)((pwm - 1500) * 1.6 + 992)).ToArray();
        }

        public static int[] TicksToUs(int[] ticksValues)
        {
            return ticksValues.Select(t => (int)((t - 992) * (5.0 / 8.0) + 1500)).ToArray();
        }
    }
}