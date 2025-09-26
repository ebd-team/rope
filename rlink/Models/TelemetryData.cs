namespace rlink
{
    public class TelemetryData
    {
        public int VoltageRaw { get; set; }
        public double VoltageV => VoltageRaw / 100.0;
        public int? CurrentMa { get; set; }
        public int? CapacityMah { get; set; }
        public int? BatteryPercent { get; set; }
    }

}
