using rlink.DataTransfer;
using rlink.DTO;
using rlink.Utils;

using System.Diagnostics;
using System.Runtime.InteropServices;

var stopwatch = Stopwatch.StartNew();
CancellationTokenSource tcpCTS = new CancellationTokenSource();

RopeReceiver _ropeReceiver = new RopeReceiver();

var builder = WebApplication.CreateBuilder(args);

// Add CORS services
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
}).AddHealthChecks();

var app = builder.Build();


// Bind config
var serialConfig = builder.Configuration.GetSection("SerialPort");
string? portName = serialConfig.GetValue<string>("PortName");
int baudRate = serialConfig.GetValue<int>("BaudRate");
string? vendorId = serialConfig.GetValue<string>("VendorId");
string? productId = serialConfig.GetValue<string>("ProductId");

// Pass to communication

var os = PortUtils.GetCurrentOSPlatform();
if (portName == null)
{
    if (os == OSPlatform.Linux)
    {
        if (!string.IsNullOrEmpty(vendorId) && !string.IsNullOrEmpty(productId))
        {
            Console.WriteLine($"Searching for serial port with VendorId: {vendorId}, ProductId: {productId}");

            portName = PortUtils.FindPortByVidPid(vendorId, productId);
            Console.WriteLine(portName is null ? "No valid serial port found." : $"Found: {portName}");
        }
        if (portName == null)
        {
            Console.WriteLine("No valid serial port found. Please check your USB connection.");
            return;
        }
    }
    else
    {
        Console.WriteLine("Invalid serial port configuration. Please check your appsettings.json. portName missed.");
        return;
    }

}

if (baudRate <= 0)
{
    Console.WriteLine("Invalid baud rate configuration. Please check your appsettings.json. baudrate missed.");
    return;
}

Console.WriteLine($"PortName: {portName}");
Console.WriteLine($"BaudRate: {baudRate}");
var com = new Communication(portName, baudRate);

var tcpConfig = builder.Configuration.GetSection("TcpOutConfig");
string? tcpHost = tcpConfig.GetValue<string>("Host");
int tcpPort = tcpConfig.GetValue<int>("Port");


var tcpInConfig = builder.Configuration.GetSection("TcpInConfig");
string? tcpInHost = tcpInConfig.GetValue<string>("Host");
int tcpInPort = tcpInConfig.GetValue<int>("Port");

if (tcpHost == null || tcpPort <= 0 || tcpInHost == null || tcpInPort <= 0)
{
    Console.WriteLine("Invalid TCP configuration. Please check your appsettings.json.");
    return;
}

var listener = new TcpDataListener(tcpInPort);

listener.DataReceived += (data) =>
{
    try
    {
        _ropeReceiver.ParseJson(data);
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error parsing data: {ex.Message}");
    }
};

_ = Task.Run(async () =>
{
    while (!tcpCTS.IsCancellationRequested)
    {
        try
        {
            Console.WriteLine("[TcpDataListener] Listener is starting.");
            await listener.StartAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TcpDataListener] Error: {ex.Message}");
            Thread.Sleep(1000);
        }
    }
});

_ = Task.Run(() =>
{
    while (true)
    {
        try
        {
            if (!com.IsConnected)
            {
                try
                {
                    com.Connect();
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error opening serial port: {ex.Message}");

                    Thread.Sleep(3000);
                    continue;
                }
            }

            if (com.IsConnected && listener.IsConnectionActive)
            {
                if (_ropeReceiver.Channels.Length > 0)
                {
                    com.UpdateData(_ropeReceiver.Channels);
                }
                com.SendFrame();
                com.ReadTelemetry();
                com.DecodeTelemetry();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in main loop: {ex.Message}");
        }

        Thread.Sleep(10);
    }
});

app.UseCors("AllowReactApp");

app.MapGet("/", () => "Rope Server is running");

app.MapGet("/telemetry", () =>
{
    return Results.Ok(com.LatestTelemetry);
});

app.MapPost("/send", (ChannelUpdateRequest request) =>
{
    if (request.Channels == null || request.Channels.Length != 16)
        return Results.BadRequest("Expected 16 channel values in the 'channels' array.");

    _ropeReceiver.UpdateChannels(request.Channels);

    return Results.Ok("Channels updated!");
});

app.MapHealthChecks("/health");

app.Run("http://0.0.0.0:5181");

