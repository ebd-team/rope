using System.Diagnostics;
using System.IO.Ports;
using System.Runtime.InteropServices;

namespace rlink.Utils
{
    public class PortUtils
    {

        public static OSPlatform GetCurrentOSPlatform()
        {
            Console.WriteLine($"Framework: {RuntimeInformation.FrameworkDescription}");
            Console.WriteLine($"Architecture: {RuntimeInformation.OSArchitecture}");

            if (OperatingSystem.IsWindows())
            {
                Console.WriteLine("Running on Windows");
                return OSPlatform.Windows;
            }
            else if (OperatingSystem.IsLinux())
            {
                Console.WriteLine("Running on Linux");
                return OSPlatform.Linux;
            }
            else if (OperatingSystem.IsMacOS())
            {
                Console.WriteLine("Running on macOS");
                return OSPlatform.OSX;
            }
            else
                throw new PlatformNotSupportedException("Unsupported operating system.");
        }

        static string ReadAllTrim(string p) => File.ReadAllText(p).Trim();

        static string? ReadlinkF(string path)
        {
            var psi = new ProcessStartInfo("readlink", $"-f {path}")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            using var p = Process.Start(psi)!;
            var s = p.StandardOutput.ReadToEnd().Trim();
            p.WaitForExit(1500);
            return p.ExitCode == 0 && s.Length > 0 ? s : null;
        }

        static (string? vid, string? pid) VidPidFromSysfs(string devPath) // e.g. "/dev/ttyUSB0"
        {
            var name = Path.GetFileName(devPath);                        // "ttyUSB0"
            var ifaceLink = $"/sys/class/tty/{name}/device";             // symlink -> .../:1.0/ttyUSB0
            var resolved = ReadlinkF(ifaceLink) ?? ifaceLink;            // <-- key change

            // Walk up until we find idVendor/idProduct
            var probe = new DirectoryInfo(resolved);
            for (int i = 0; i < 8 && probe is not null; i++, probe = probe.Parent!)
            {
                var vidP = Path.Combine(probe.FullName, "idVendor");
                var pidP = Path.Combine(probe.FullName, "idProduct");
                if (File.Exists(vidP) && File.Exists(pidP))
                    return (ReadAllTrim(vidP), ReadAllTrim(pidP));
            }
            return (null, null);
        }

        static (string? vid, string? pid) VidPidFromUdev(string devPath)
        {
            var psi = new ProcessStartInfo("udevadm", $"info -q property -n {devPath}")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false
            };
            using var p = Process.Start(psi)!;
            var text = p.StandardOutput.ReadToEnd();
            p.WaitForExit(1500);
            string? vid = null, pid = null;
            foreach (var line in text.Split('\n'))
            {
                if (line.StartsWith("ID_VENDOR_ID=")) vid = line["ID_VENDOR_ID=".Length..].Trim();
                if (line.StartsWith("ID_MODEL_ID=")) pid = line["ID_MODEL_ID=".Length..].Trim();
            }
            return (vid, pid);
        }

        static bool Match(string? got, string want)
        {
            if (got is null) return false;
            string norm(string s) => s.Trim().TrimStart('0').ToUpperInvariant().PadLeft(4, '0');
            return norm(got) == norm(want);
        }

        public static string? FindPortByVidPid(string wantVid, string wantPid)
        {
            foreach (var dev in SerialPort.GetPortNames())
            {
                // Try sysfs first
                var (sv, sp) = VidPidFromSysfs(dev);
                if (!string.IsNullOrEmpty(sv) && !string.IsNullOrEmpty(sp))
                {
                    if (Match(sv, wantVid) && Match(sp, wantPid)) return dev;
                }
                else
                {
                    // Fallback to udev
                    var (uv, up) = VidPidFromUdev(dev);
                    if (Match(uv, wantVid) && Match(up, wantPid)) return dev;
                }
            }
            return null;
        }


        //public static void DumpAll()
        //{
        //    var ports = SerialPort.GetPortNames();
        //    if (ports.Length == 0) { Console.WriteLine("[DBG] No serial ports found by .NET"); return; }

        //    foreach (var dev in ports)
        //    {
        //        Console.WriteLine($"=== {dev} ===");
        //        var (vid, pid, manu, prod, where) = GetUsbIds_sysfs(dev);
        //        if (vid is null || pid is null)
        //        {
        //            var (uVid, uPid) = GetUsbIds_udevadm(dev);
        //            Console.WriteLine($"Result: VID={uVid ?? ""} PID={uPid ?? ""} MANU={manu ?? ""} PROD={prod ?? ""}");
        //        }
        //        else
        //        {
        //            Console.WriteLine($"Result: VID={vid} PID={pid} MANU={manu ?? ""} PROD={prod ?? ""} (at {where})");
        //        }
        //    }
        //}


        public static string FindSerialPortByUsbId(string vendorId, string productId)
        {
            foreach (var port in SerialPort.GetPortNames())
            {
                try
                {
                    Console.WriteLine($"Checking port: {port}");
                    string devPath = $"/sys/class/tty/{Path.GetFileName(port)}/device/";
                    Console.WriteLine($"Device path: {devPath}");
                    if (!Directory.Exists(devPath))
                        continue;

                    string vendorPath = Path.Combine(devPath, "idVendor");
                    string productPath = Path.Combine(devPath, "idProduct");

                    if (File.Exists(vendorPath) && File.Exists(productPath))
                    {
                        string vendor = File.ReadAllText(vendorPath).Trim();
                        string product = File.ReadAllText(productPath).Trim();

                        Console.WriteLine($"Checking port: {port}, Vendor: {vendor}, Product: {product}");
                        if (vendor.Equals(vendorId, StringComparison.OrdinalIgnoreCase) &&
                            product.Equals(productId, StringComparison.OrdinalIgnoreCase))
                        {
                            return port;
                        }
                    }
                }
                catch
                {
                    // Ignore errors for ports we can't access
                }
            }
            return null;
        }
    }
}
