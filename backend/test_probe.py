import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def test():
    client = AsyncIOMotorClient('mongodb://mongodb:27017/zwmon_db')
    db = client['zwmon_db']
    cctv = await db.service_points.find_one({"service_type": "cctv"})
    print("Found CCTV:", cctv['name'])
    
    rtsp_url = f"rtsp://{cctv.get('cctv_username', 'admin')}:{cctv.get('cctv_password', '')}@{cctv.get('ip_address')}:554/Streaming/Channels/102"
    print("Testing:", rtsp_url)
    
    cmd = ['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'default=noprint_wrappers=1:nokey=1', '-stimeout', '5000000', rtsp_url]
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=8.0)
    print("Codec:", stdout.decode().strip())

asyncio.run(test())
