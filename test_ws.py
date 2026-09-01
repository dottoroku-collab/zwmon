import asyncio
import websockets

async def test():
    uri = "wss://api.zwmon.com/ws/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZjE0NDEyMjQtOTRjNC00ZWZlLTlkYmEtZDM0NTMzOTZmODZjIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg4MjEyNjE0fQ.kZ0cZf0xOq01nVwz5abuGByurjCOQFel9Yww0PuEBD4"
    try:
        async with websockets.connect(uri, extra_headers={"Origin": "https://zwmon.com"}) as websocket:
            print("Connected!")
            await websocket.send("ping")
            response = await websocket.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
