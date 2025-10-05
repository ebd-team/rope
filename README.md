# Rope

**Rope** is an experimental project demonstrating multiple approaches to **remote control for drones**.  
It showcases how to combine **low-latency communication**, **gamepad input handling**, and **real-time video and telemetry streaming** into a flexible, modular control system.

## ✨ Features
- 🎮 Gamepad input capture and transmission  
- 📡 Low-latency communication channels (WebSocket, TCP/UDP, Peer-to-Peer WebRTC)  
- 🎥 Integrated low-latency video and telemetry streaming  
- 🔧 Modular design for experimenting with different transport layers  
- 🚀 Optimized for drone and robotics applications  

## 🎯 Goals
- Provide a **sandbox environment** for testing various remote-control methods  
- Explore **efficient communication protocols** for real-time vehicle operation  
- Serve as a **reference platform** for drone developers and robotics enthusiasts  

## 🛠️ Tech Stack
- **Frontend:** React + TypeScript  
- **Backend:** .NET (communication and telemetry)  
- **Streaming:** FFmpeg / MediaMTX  


## Example: Airwire + rlink + rclient in Action

[Rope](https://github.com/ebd-team/rope) uses [**Airwire**](https://ebd-team.github.io/airwire) as its communication backbone, enabling **secure, low-latency connections between machines across any network** — including LTE, Starlink, or home internet.  
**Airwire** is lightweight, cross-platform, and efficient enough to run even on small devices like the Raspberry Pi 3.

Below is an example setup showing how **Airwire** operates as the communication layer between **rlink** and **rclient**:

![Airwire Communication Example](https://github.com/ebd-team/rope/blob/main/assets/rope_set_1.png)
![FT232 + ESP32 OLED](https://github.com/ebd-team/rope/blob/main/assets/FC_FT232.jpg)

In this example:

- **Airwire** runs as the real-time communication hub, managing multiple data channels across different networks.  
- **rlink** serves as the bridge between Airwire and the flight controller, forwarding control data as **CRSF packets**.  
- **rclient (Rope)** provides the web interface — here, a **TX16S joystick** is connected and actively transmitting channel values.  
- The dashboard confirms **Airwire Health: ✅ Healthy**, indicating stable, low-latency communication across all layers.  
- The **flight controller** is connected via **USB through an FTDI adapter**.  

This setup demonstrates the complete end-to-end control flow:

**Controller → rclient → Airwire → rlink → Flight Controller**
