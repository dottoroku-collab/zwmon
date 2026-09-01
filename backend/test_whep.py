import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        offer = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nc=IN IP4 127.0.0.1\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=rtpmap:96 H264/90000\r\na=setup:actpass\r\na=mid:0\r\na=sendrecv\r\n"
        res = await client.post('http://zwmon_mediamtx:8889/1f432817-1da5-4db7-9d3b-12123876d072/whep', headers={'Content-Type': 'application/sdp'}, content=offer, timeout=15.0)
        print("Status:", res.status_code)
        print("Body:", res.text)

asyncio.run(test())
