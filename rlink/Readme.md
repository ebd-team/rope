# rlink

**rlink** is part of the rope ecosystem.  
It serves as a communication bridge between the **server**, the **client**, and the **flight controller**.

## Overview

The application establishes a TCP connection to receive real-time channel data from [Airwire](https://airwire.ebdsolutions.net/) .  
This channel data is then:

1. **Received** on a specified TCP port.  
2. **Packed** into a [CRSF (Crossfire)](https://www.team-blacksheep.com/tbs-crossfire) message format.  
3. **Forwarded** to the flight controller for further processing.

## Workflow

```mermaid
flowchart LR
    A[Airwire Server] -->|TCP| B[rlink App]
    B -->|Pack to CRSF| C[Flight Controller]
